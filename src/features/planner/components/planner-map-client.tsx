import PlannerMapSceneController from "@/components/map/PlannerMapSceneController"
import PlannerMobHoverPopup from "@/components/map/PlannerMobHoverPopup"
import PlannerNoteMarker from "@/components/map/PlannerNoteMarker"
import PlannerPoiMarker from "@/components/map/PlannerPoiMarker"
import PlannerStickerMarker from "@/components/map/PlannerStickerMarker"
import {
  MapMarker,
  MarkerContent,
  Map as SharedMap,
  MapRoute,
} from "@/components/ui/map"
import { dungeons } from "@/features/planner/data/dungeons"
import { PlannerSelectedStickerTray } from "@/features/planner/components/planner-selected-sticker-tray"
import { PlannerMapContextMenu } from "@/features/planner/components/planner-map-context-menu"
import { PlannerMobInfoDialog } from "@/features/planner/components/planner-mob-info-dialog"
import { PlannerNoteDialog } from "@/features/planner/components/planner-note-dialog"
import {
  clampPlannerPointToRange,
  getPlannerPointDistance,
  getUnpairedWarlockGate,
  getWarlockGateConnections,
  warlockGateMaxRange,
} from "@/features/planner/lib/gates"
import { plannerStickerMeta } from "@/features/planner/lib/stickers"
import { cn } from "@/lib/utils"
import {
  circlePolygon,
  mapCenter,
  pointToLngLat,
  warmDungeonMapAssets,
} from "@/features/planner/lib/map"
import { getPullColor } from "@/features/planner/lib/pull-colors"
import {
  selectActiveDungeon,
  selectActiveRoute,
  selectDraftDrawing,
  selectDrawTool,
  selectMode,
  selectSelectedPullId,
  usePlannerStore,
} from "@/features/planner/store/planner-store"
import type {
  MobSpawn,
  PlannerSticker,
  PlannerStickerKind,
  PlannerStickerLabelPosition,
  Point,
  SpawnId,
} from "@/features/planner/types"
import type { StyleSpecification } from "maplibre-gl"
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

const poiIcons = {
  dungeonEntrance: "/images/dungeon_start.png",
  graveyard: "/images/graveyard.png",
} as const

const blankStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#101010",
      },
    },
  ],
}

export type PlannerMapLoadPhase = "loading-assets" | "switching-scene" | "ready"

export type ActiveDungeonAsset = {
  cacheKey: string
  source: "memory" | "indexeddb" | "built"
}

type MapContextMenuState = {
  x: number
  y: number
  position: Point
  mobSpawn: MobSpawn | null
  sticker: PlannerSticker | null
}

type PendingMapAnnotation =
  | {
      kind: "note"
      mobSpawn: MobSpawn | null
      position: Point
    }
  | {
      kind: "edit-sticker"
      stickerId: string
      stickerKind: PlannerSticker["kind"]
      labelPosition: PlannerStickerLabelPosition
      position: Point
      text: string
    }
function getCentroid(points: Point[]) {
  const total = points.reduce<Point>(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0],
  )

  return [total[0] / points.length, total[1] / points.length] as Point
}

function mobScaleToRadius(scale: number) {
  return scale * 2.8
}

function getMobSpawnScale(mobSpawn: MobSpawn) {
  return mobSpawn.spawn.scale ?? mobSpawn.mob.scale ?? 1
}

function isStrictlyLowerLeft(point1: Point, point2: Point) {
  return (
    point1[1] < point2[1] || (point1[1] === point2[1] && point1[0] < point2[0])
  )
}

function isLeftOfLineSegment(origin: Point, point1: Point, point2: Point) {
  const vector1 = [point1[0] - origin[0], point1[1] - origin[1]] as const
  const vector2 = [point2[0] - origin[0], point2[1] - origin[1]] as const
  const crossProduct = vector1[0] * vector2[1] - vector1[1] * vector2[0]
  return crossProduct > 0
}

function makeConvexHull<T extends { pos: Point }>(vertices: T[]) {
  if (vertices.length === 0) {
    return []
  }

  const points = vertices.map((vertex) => vertex.pos)
  let lowerLeftIndex = 0

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    const lowerLeftPoint = points[lowerLeftIndex]
    if (!point || !lowerLeftPoint) {
      continue
    }

    if (isStrictlyLowerLeft(point, lowerLeftPoint)) {
      lowerLeftIndex = index
    }
  }

  const hullIndexes: number[] = []
  let loopCount = 0
  let startingPointIndex = lowerLeftIndex
  let nextPointIndex = 0

  while (nextPointIndex !== hullIndexes[0] && loopCount < 100) {
    hullIndexes.push(startingPointIndex)
    nextPointIndex = 0

    for (let index = 0; index < points.length; index += 1) {
      const origin = points[startingPointIndex]
      const point1 = points[nextPointIndex]
      const point2 = points[index]
      if (
        origin &&
        point1 &&
        point2 &&
        index !== startingPointIndex &&
        (startingPointIndex === nextPointIndex ||
          isLeftOfLineSegment(origin, point1, point2))
      ) {
        nextPointIndex = index
      }
    }

    startingPointIndex = nextPointIndex
    loopCount += 1
  }

  return hullIndexes.flatMap((index) => {
    const vertex = vertices[index]
    return vertex ? [vertex] : []
  })
}

function expandPolygon(
  vertices: Array<{ pos: Point; scale: number }>,
  numCirclePoints: number,
) {
  const expandedPolygon: Array<{ pos: Point; scale: number }> = []

  for (const { pos, scale } of vertices) {
    const radius = mobScaleToRadius(scale)
    const adjustedNumPoints = Math.max(1, Math.floor(numCirclePoints * radius))

    for (let index = 1; index <= adjustedNumPoints; index += 1) {
      const angle = ((2 * Math.PI) / adjustedNumPoints) * index
      expandedPolygon.push({
        pos: [
          pos[0] + radius * Math.cos(angle),
          pos[1] + radius * Math.sin(angle),
        ],
        scale,
      })
    }
  }

  return expandedPolygon
}

export function getSelectedPullOutline(mobSpawns: MobSpawn[]) {
  if (mobSpawns.length === 0) {
    return null
  }

  if (mobSpawns.length === 1) {
    const mobSpawn = mobSpawns[0]
    if (!mobSpawn) {
      return null
    }

    return {
      hull: circlePolygon(
        mobSpawn.spawn.pos,
        mobScaleToRadius(getMobSpawnScale(mobSpawn)),
      ),
    }
  }

  const vertices = mobSpawns.map((mobSpawn) => ({
    pos: mobSpawn.spawn.pos,
    scale: getMobSpawnScale(mobSpawn),
  }))
  const expandedHull = makeConvexHull(
    expandPolygon(makeConvexHull(vertices), 10),
  )

  if (expandedHull.length < 3) {
    const center = getCentroid(mobSpawns.map((mobSpawn) => mobSpawn.spawn.pos))
    return {
      hull: circlePolygon(center, 14),
    }
  }

  return {
    hull: expandedHull.map((vertex) => vertex.pos),
  }
}

function getPullOutlineCenter(
  outline: ReturnType<typeof getSelectedPullOutline>,
) {
  if (!outline?.hull?.length) {
    return null
  }

  return getCentroid(outline.hull)
}

function queueIdleTask(task: () => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (idleWindow.requestIdleCallback) {
    const idleId = idleWindow.requestIdleCallback(() => task())
    return () => idleWindow.cancelIdleCallback?.(idleId)
  }

  const timeoutId = window.setTimeout(task, 0)
  return () => window.clearTimeout(timeoutId)
}

export function PlannerMapClient() {
  const setMode = usePlannerStore((state) => state.setMode)
  const setDrawTool = usePlannerStore((state) => state.setDrawTool)
  const toggleSpawn = usePlannerStore((state) => state.toggleSpawn)
  const appendDraftPoint = usePlannerStore((state) => state.appendDraftPoint)
  const addNote = usePlannerStore((state) => state.addNote)
  const addSticker = usePlannerStore((state) => state.addSticker)
  const updateSticker = usePlannerStore((state) => state.updateSticker)
  const moveSticker = usePlannerStore((state) => state.moveSticker)
  const deleteSticker = usePlannerStore((state) => state.deleteSticker)
  const dungeon = usePlannerStore((state) => selectActiveDungeon(state.present))
  const route = usePlannerStore((state) => selectActiveRoute(state.present))
  const mode = usePlannerStore((state) => selectMode(state.present))
  const drawTool = usePlannerStore((state) => selectDrawTool(state.present))
  const draftDrawing = usePlannerStore((state) =>
    selectDraftDrawing(state.present),
  )
  const selectedPullId = usePlannerStore((state) =>
    selectSelectedPullId(state.present),
  )
  const [activeSceneDungeonKey, setActiveSceneDungeonKey] = useState<
    string | null
  >(null)
  const [loadPhase, setLoadPhase] =
    useState<PlannerMapLoadPhase>("loading-assets")
  const [mapError, setMapError] = useState<string | null>(null)
  const [, setActiveDungeonAsset] = useState<ActiveDungeonAsset | null>(null)
  const [showBlockingOverlay, setShowBlockingOverlay] = useState(true)
  const [mapContextMenu, setMapContextMenu] =
    useState<MapContextMenuState | null>(null)
  const [pendingAnnotation, setPendingAnnotation] =
    useState<PendingMapAnnotation | null>(null)
  const [pendingStickerMoveId, setPendingStickerMoveId] = useState<
    string | null
  >(null)
  const [infoMobSpawn, setInfoMobSpawn] = useState<MobSpawn | null>(null)
  const [hoveredSpawnId, setHoveredSpawnId] = useState<SpawnId | null>(null)
  const [modifierMode, setModifierMode] = useState<"default" | "ctrl" | "alt">(
    "default",
  )
  const [pointerPreview, setPointerPreview] = useState<{
    inside: boolean
    x: number
    y: number
  }>({
    inside: false,
    x: 0,
    y: 0,
  })
  const [mapPointerPoint, setMapPointerPoint] = useState<Point | null>(null)
  const [dragPreview, setDragPreview] = useState<{
    stickerId: string
    position: Point
  } | null>(null)
  const mapContextMenuRef = useRef<HTMLDivElement | null>(null)

  const selectedPull = useMemo(
    () =>
      route?.pulls.find((pull) => pull.id === selectedPullId) ??
      route?.pulls[0],
    [route, selectedPullId],
  )

  const routeVisualState = useMemo(() => {
    const selectedSpawnIds = new Set(selectedPull?.spawns ?? [])
    const pullIndexBySpawn = new globalThis.Map<string, number>()
    const pullColorBySpawn = new globalThis.Map<string, string>()

    route?.pulls.forEach((pull, pullIndex) => {
      const color = getPullColor(pullIndex)
      pull.spawns.forEach((spawnId) => {
        pullIndexBySpawn.set(spawnId, pullIndex)
        pullColorBySpawn.set(spawnId, color)
      })
    })

    return {
      selectedSpawnIds,
      pullIndexBySpawn,
      pullColorBySpawn,
    }
  }, [route, selectedPull])

  const pullOutlines = useMemo(() => {
    return (
      route?.pulls.map((pull, pullIndex) => ({
        pullId: pull.id,
        pullNumber: pullIndex + 1,
        color: getPullColor(pullIndex),
        selected: pull.id === selectedPull?.id,
        outline: getSelectedPullOutline(
          pull.spawns.flatMap((spawnId) => {
            const mobSpawn = dungeon.mobSpawns[spawnId]
            return mobSpawn ? [mobSpawn] : []
          }),
        ),
      })) ?? []
    )
  }, [dungeon.mobSpawns, route, selectedPull?.id])

  const orderedPullOutlines = useMemo(
    () => [
      ...pullOutlines.filter(({ pullId }) => pullId !== selectedPull?.id),
      ...pullOutlines.filter(({ pullId }) => pullId === selectedPull?.id),
    ],
    [pullOutlines, selectedPull?.id],
  )
  const sceneMounted = activeSceneDungeonKey === dungeon.key && !mapError
  const sceneReady = loadPhase === "ready"
  const hoveredMobSpawn = hoveredSpawnId
    ? dungeon.mobSpawns[hoveredSpawnId] ?? null
    : null
  const hoveredPullIndex = hoveredSpawnId
    ? routeVisualState.pullIndexBySpawn.get(hoveredSpawnId)
    : undefined
  const hoveredGroup = hoveredMobSpawn?.spawn.group ?? null
  const pendingStickerKind = useMemo<PlannerStickerKind | null>(() => {
    if (!pendingStickerMoveId) {
      return null
    }

    return (
      route?.stickers.find((item) => item.id === pendingStickerMoveId)?.kind ??
      null
    )
  }, [pendingStickerMoveId, route?.stickers])
  const activeStickerKind =
    pendingStickerKind ??
    (mode === "draw" && drawTool !== "line" ? drawTool : null)
  const showStickerCursorPreview =
    activeStickerKind !== null && pointerPreview.inside && sceneMounted
  const baseGateConnections = useMemo(
    () => getWarlockGateConnections(route?.stickers ?? []),
    [route?.stickers],
  )
  const baseGateConnectionLookup = useMemo(() => {
    const lookup = new Map<string, (typeof baseGateConnections)[number]>()

    baseGateConnections.forEach((connection) => {
      lookup.set(connection.originId, connection)
      lookup.set(connection.destinationId, connection)
    })

    return lookup
  }, [baseGateConnections])
  const clampedPendingMovePoint = useMemo(() => {
    if (
      !pendingStickerMoveId ||
      pendingStickerKind !== "warlockGate" ||
      !mapPointerPoint
    ) {
      return mapPointerPoint
    }

    const pair = baseGateConnectionLookup.get(pendingStickerMoveId)
    if (!pair) {
      return mapPointerPoint
    }

    const originPosition =
      pair.originId === pendingStickerMoveId
        ? pair.destinationPosition
        : pair.originPosition

    return clampPlannerPointToRange(originPosition, mapPointerPoint)
  }, [
    baseGateConnectionLookup,
    mapPointerPoint,
    pendingStickerKind,
    pendingStickerMoveId,
  ])
  const gatePositionOverrides = useMemo(() => {
    const overrides = new Map<string, Point>()

    if (dragPreview) {
      overrides.set(dragPreview.stickerId, dragPreview.position)
    } else if (
      pendingStickerMoveId &&
      pendingStickerKind === "warlockGate" &&
      clampedPendingMovePoint
    ) {
      overrides.set(pendingStickerMoveId, clampedPendingMovePoint)
    }

    return overrides
  }, [
    clampedPendingMovePoint,
    dragPreview,
    pendingStickerKind,
    pendingStickerMoveId,
  ])
  const gateConnections = useMemo(
    () => getWarlockGateConnections(route?.stickers ?? [], gatePositionOverrides),
    [gatePositionOverrides, route?.stickers],
  )
  const invalidGateStickerIds = useMemo(() => {
    const stickerIds = new Set<string>()

    gateConnections.forEach((connection) => {
      if (connection.withinRange) {
        return
      }

      stickerIds.add(connection.originId)
      stickerIds.add(connection.destinationId)
    })

    return stickerIds
  }, [gateConnections])
  const gateConnectionLookup = useMemo(() => {
    const lookup = new Map<string, (typeof gateConnections)[number]>()

    gateConnections.forEach((connection) => {
      lookup.set(connection.originId, connection)
      lookup.set(connection.destinationId, connection)
    })

    return lookup
  }, [gateConnections])
  const stickerById = useMemo(
    () => new Map((route?.stickers ?? []).map((sticker) => [sticker.id, sticker])),
    [route?.stickers],
  )
  const renderedStickers = useMemo(
    () =>
      route?.stickers.filter((sticker) => sticker.id !== pendingStickerMoveId) ??
      [],
    [pendingStickerMoveId, route?.stickers],
  )
  const gatePreviewGuide = useMemo(() => {
    if (!sceneMounted || activeStickerKind !== "warlockGate") {
      return null
    }

    if (pendingStickerMoveId && pendingStickerKind === "warlockGate") {
      const previewPosition = gatePositionOverrides.get(pendingStickerMoveId)
      const pair = gateConnectionLookup.get(pendingStickerMoveId)
      if (!previewPosition || !pair) {
        return null
      }

      const originPosition =
        pair.originId === pendingStickerMoveId
          ? pair.destinationPosition
          : pair.originPosition
      const distance = getPlannerPointDistance(originPosition, previewPosition)

      return {
        originPosition,
        previewPosition,
        withinRange: distance <= warlockGateMaxRange,
      }
    }

    if (dragPreview) {
      const pair = gateConnectionLookup.get(dragPreview.stickerId)
      if (!pair) {
        return null
      }

      const originPosition =
        pair.originId === dragPreview.stickerId
          ? pair.destinationPosition
          : pair.originPosition
      const distance = getPlannerPointDistance(originPosition, dragPreview.position)

      return {
        originPosition,
        previewPosition: dragPreview.position,
        withinRange: distance <= warlockGateMaxRange,
      }
    }

    const unpairedGate = getUnpairedWarlockGate(route?.stickers ?? [])
    if (!unpairedGate || !mapPointerPoint) {
      return null
    }

    const previewPosition = clampPlannerPointToRange(
      unpairedGate.position,
      mapPointerPoint,
    )

    return {
      originPosition: unpairedGate.position,
      previewPosition,
      withinRange: true,
    }
  }, [
    activeStickerKind,
    dragPreview,
    gateConnectionLookup,
    gatePositionOverrides,
    mapPointerPoint,
    pendingStickerKind,
    pendingStickerMoveId,
    route?.stickers,
    sceneMounted,
  ])

  function loadingMessage() {
    if (loadPhase === "switching-scene") {
      return "Switching dungeon..."
    }

    return "Loading planner surface..."
  }

  useEffect(() => {
    const cancelIdle = queueIdleTask(() => {
      void warmDungeonMapAssets(dungeons.map((item) => item.key))
    })

    return cancelIdle
  }, [])

  useEffect(() => {
    function syncModifierKeys(event: KeyboardEvent) {
      setModifierMode(
        event.ctrlKey || event.metaKey
        ? "ctrl"
        : event.altKey
          ? "alt"
          : "default",
      )
    }

    function resetModifierKeys() {
      setModifierMode("default")
    }

    setModifierMode("default")
    window.addEventListener("keydown", syncModifierKeys)
    window.addEventListener("keyup", syncModifierKeys)
    window.addEventListener("blur", resetModifierKeys)

    return () => {
      window.removeEventListener("keydown", syncModifierKeys)
      window.removeEventListener("keyup", syncModifierKeys)
      window.removeEventListener("blur", resetModifierKeys)
    }
  }, [])

  useEffect(() => {
    setHoveredSpawnId(null)
    setMapContextMenu(null)
  }, [dungeon.key, sceneMounted])

  const closeMapContextMenu = useCallback(() => {
    setMapContextMenu(null)
  }, [])

  const openMapContextMenu = useCallback(
    ({
      clientX,
      clientY,
      point,
    }: {
      clientX: number
      clientY: number
      point: Point
    }) => {
      setMapContextMenu({
        x: clientX + 4,
        y: clientY + 4,
        position: point,
        mobSpawn: null,
        sticker: null,
      })
    },
    [],
  )

  const openMarkerContextMenu = useCallback(
    (
      event: ReactMouseEvent<HTMLDivElement>,
      position: Point,
      mobSpawn: MobSpawn | null,
      sticker: PlannerSticker | null = null,
    ) => {
      setMapContextMenu({
        x: event.clientX + 4,
        y: event.clientY + 4,
        position,
        mobSpawn,
        sticker,
      })
    },
    [],
  )

  const openMobContextMenu = useCallback(
    ({
      clientX,
      clientY,
      spawnId,
    }: {
      clientX: number
      clientY: number
      spawnId: SpawnId
    }) => {
      const mobSpawn = dungeon.mobSpawns[spawnId]
      if (!mobSpawn) {
        return
      }

      setMapContextMenu({
        x: clientX + 4,
        y: clientY + 4,
        position: mobSpawn.spawn.pos,
        mobSpawn,
        sticker: null,
      })
    },
    [dungeon.mobSpawns],
  )

  const handleStaticMarkerContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, position: Point) => {
      openMarkerContextMenu(event, position, null)
    },
    [openMarkerContextMenu],
  )

  const handleStickerContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, sticker: PlannerSticker) => {
      openMarkerContextMenu(event, sticker.position, null, sticker)
    },
    [openMarkerContextMenu],
  )

  const handleDeleteSticker = useCallback(() => {
    if (!mapContextMenu?.sticker) {
      return
    }

    deleteSticker(mapContextMenu.sticker.id)
    closeMapContextMenu()
  }, [closeMapContextMenu, deleteSticker, mapContextMenu])

  const handleMoveSticker = useCallback(() => {
    if (!mapContextMenu?.sticker) {
      return
    }

    setPendingStickerMoveId(mapContextMenu.sticker.id)
    closeMapContextMenu()
  }, [closeMapContextMenu, mapContextMenu])

  const handlePlaceMovedSticker = useCallback(
    (point: Point) => {
      if (!pendingStickerMoveId) {
        return false
      }

      let nextPosition = point
      if (pendingStickerKind === "warlockGate") {
        const pair = baseGateConnectionLookup.get(pendingStickerMoveId)
        if (pair) {
          const originPosition =
            pair.originId === pendingStickerMoveId
              ? pair.destinationPosition
              : pair.originPosition
          nextPosition = clampPlannerPointToRange(originPosition, point)
        }
      }

      moveSticker(pendingStickerMoveId, nextPosition)
      setPendingStickerMoveId(null)
      setMapPointerPoint(null)
      return true
    },
    [baseGateConnectionLookup, moveSticker, pendingStickerKind, pendingStickerMoveId],
  )

  const handleOpenAddNoteDialog = useCallback(() => {
    if (!mapContextMenu) {
      return
    }

    setPendingAnnotation({
      kind: "note",
      mobSpawn: mapContextMenu.mobSpawn,
      position: mapContextMenu.position,
    })
    closeMapContextMenu()
  }, [closeMapContextMenu, mapContextMenu])

  const handleCreateAnnotation = useCallback(
    ({
      text,
      labelPosition,
    }: {
      text: string
      labelPosition: PlannerStickerLabelPosition
    }) => {
      if (!pendingAnnotation) {
        return
      }

      if (pendingAnnotation.kind === "note") {
        addNote(pendingAnnotation.position, text)
      } else {
        updateSticker(pendingAnnotation.stickerId, {
          text,
          labelPosition,
        })
      }

      setPendingAnnotation(null)
    },
    [addNote, pendingAnnotation, updateSticker],
  )

  const handlePlaceSticker = useCallback(
    (kind: PlannerSticker["kind"], position: Point) => {
      if (kind === "warlockGate") {
        const unpairedGate = getUnpairedWarlockGate(route?.stickers ?? [])
        if (unpairedGate) {
          addSticker(
            kind,
            clampPlannerPointToRange(unpairedGate.position, position),
            plannerStickerMeta[kind].defaultText,
          )
          setDrawTool("line")
          setMode("pulls")
          return
        }
      }

      addSticker(kind, position, plannerStickerMeta[kind].defaultText)
      setDrawTool("line")
      setMode("pulls")
    },
    [addSticker, route?.stickers, setDrawTool, setMode],
  )

  const handleShiftDragPreview = useCallback(
    (sticker: PlannerSticker, position: Point | null) => {
      if (sticker.kind !== "warlockGate") {
        return
      }

      const pair = baseGateConnectionLookup.get(sticker.id)
      const nextPosition =
        pair && position
          ? clampPlannerPointToRange(
              pair.originId === sticker.id
                ? pair.destinationPosition
                : pair.originPosition,
              position,
            )
          : position

      setDragPreview(
        nextPosition
          ? {
              stickerId: sticker.id,
              position: nextPosition,
            }
          : null,
      )
    },
    [baseGateConnectionLookup],
  )

  const handleShiftDragSticker = useCallback(
    (sticker: PlannerSticker, position: Point) => {
      let nextPosition = position

      if (sticker.kind === "warlockGate") {
        const pair = baseGateConnectionLookup.get(sticker.id)
        if (pair) {
          nextPosition = clampPlannerPointToRange(
            pair.originId === sticker.id
              ? pair.destinationPosition
              : pair.originPosition,
            position,
          )
        }
      }

      moveSticker(sticker.id, nextPosition)
    },
    [baseGateConnectionLookup, moveSticker],
  )

  const handleOpenEditStickerDialog = useCallback(() => {
    if (!mapContextMenu?.sticker) {
      return
    }

    setPendingAnnotation({
      kind: "edit-sticker",
      stickerId: mapContextMenu.sticker.id,
      stickerKind: mapContextMenu.sticker.kind,
      labelPosition: mapContextMenu.sticker.labelPosition ?? "right",
      position: mapContextMenu.sticker.position,
      text:
        mapContextMenu.sticker.text ??
        plannerStickerMeta[mapContextMenu.sticker.kind].defaultText ??
        plannerStickerMeta[mapContextMenu.sticker.kind].chipLabel,
    })
    closeMapContextMenu()
  }, [closeMapContextMenu, mapContextMenu])

  const handleOpenMobInfoDialog = useCallback(() => {
    if (!mapContextMenu?.mobSpawn) {
      return
    }

    setInfoMobSpawn(mapContextMenu.mobSpawn)
    closeMapContextMenu()
  }, [closeMapContextMenu, mapContextMenu])

  const handleExitStickerMode = useCallback(() => {
    setPendingStickerMoveId(null)
    setPendingAnnotation(null)
    setDrawTool("line")
    setMode("pulls")
  }, [setDrawTool, setMode])

  useEffect(() => {
    if (!mapContextMenu) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Node &&
        mapContextMenuRef.current?.contains(target)
      ) {
        return
      }

      closeMapContextMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMapContextMenu()
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", closeMapContextMenu)
    window.addEventListener("scroll", closeMapContextMenu, true)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", closeMapContextMenu)
      window.removeEventListener("scroll", closeMapContextMenu, true)
    }
  }, [closeMapContextMenu, mapContextMenu])

  useEffect(() => {
    if (!pendingStickerMoveId) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPendingStickerMoveId(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [pendingStickerMoveId])

  if (!route) {
    return null
  }

  return (
    <div
      className={activeStickerKind ? "relative h-full w-full cursor-none bg-background" : "relative h-full w-full bg-background"}
      onPointerEnter={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        setPointerPreview({
          inside: true,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        })
      }}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        setPointerPreview({
          inside: true,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        })
      }}
      onPointerLeave={() => {
        setPointerPreview((current) => ({ ...current, inside: false }))
      }}
    >
      <SharedMap
        className="planner-map h-full w-full bg-background"
        styles={{ dark: blankStyle, light: blankStyle }}
        center={mapCenter}
        zoom={0}
        minZoom={-2}
        maxZoom={14}
        attributionControl={false}
        dragRotate={false}
        pitchWithRotate={false}
        doubleClickZoom={false}
        boxZoom={false}
        touchPitch={false}
      >
        <PlannerMapSceneController
          dungeon={dungeon}
          dungeonKey={dungeon.key}
          hoveredGroup={hoveredGroup}
          mode={mode}
          modifierMode={modifierMode}
          openMobContextMenu={openMobContextMenu}
          drawTool={drawTool}
          orderedPullOutlines={orderedPullOutlines}
          pullColorBySpawn={routeVisualState.pullColorBySpawn}
          routeDrawings={route.drawings}
          sceneMounted={sceneMounted}
          selectedSpawnIds={routeVisualState.selectedSpawnIds}
          setHoveredSpawnId={setHoveredSpawnId}
          draftDrawing={draftDrawing}
          movePendingSticker={handlePlaceMovedSticker}
          addNote={addNote}
          placeSticker={handlePlaceSticker}
          appendDraftPoint={appendDraftPoint}
          openContextMenu={openMapContextMenu}
          setPointerPoint={setMapPointerPoint}
          setActiveDungeonAsset={setActiveDungeonAsset}
          setActiveSceneDungeonKey={setActiveSceneDungeonKey}
          setLoadPhase={setLoadPhase}
          setMapError={setMapError}
          setShowBlockingOverlay={setShowBlockingOverlay}
          toggleSpawn={toggleSpawn}
        />

        {sceneMounted ? (
          <PlannerMobHoverPopup
            mobSpawn={hoveredMobSpawn}
            pullIndex={hoveredPullIndex}
            totalEnemyForces={dungeon.mdt.totalCount}
          />
        ) : null}

        {sceneMounted
          ? gateConnections.map((connection) => (
              <div key={connection.id}>
                <MapRoute
                  id={`${connection.id}-base`}
                  coordinates={[
                    pointToLngLat(connection.originPosition),
                    pointToLngLat(connection.destinationPosition),
                  ]}
                  color={connection.withinRange ? "#09090b" : "#2b0a0e"}
                  width={connection.withinRange ? 6 : 7}
                  opacity={connection.withinRange ? 0.32 : 0.55}
                  interactive={false}
                />
                <MapRoute
                  id={`${connection.id}-gate`}
                  coordinates={[
                    pointToLngLat(connection.originPosition),
                    pointToLngLat(connection.destinationPosition),
                  ]}
                  color={connection.withinRange ? "#c084fc" : "#f87171"}
                  width={connection.withinRange ? 3 : 3.5}
                  opacity={0.95}
                  dashArray={[1.2, 2.1]}
                  interactive={false}
                />
                {(() => {
                  const originSticker = stickerById.get(connection.originId)
                  const destinationSticker = stickerById.get(
                    connection.destinationId,
                  )
                  const hideLabel =
                    originSticker?.labelPosition === "none" &&
                    destinationSticker?.labelPosition === "none"
                  const label =
                    originSticker?.text ||
                    destinationSticker?.text ||
                    plannerStickerMeta.warlockGate.defaultText ||
                    plannerStickerMeta.warlockGate.chipLabel

                  if (hideLabel || !label) {
                    return null
                  }

                  const midpoint: Point = [
                    (connection.originPosition[0] + connection.destinationPosition[0]) /
                      2,
                    (connection.originPosition[1] +
                      connection.destinationPosition[1]) /
                      2,
                  ]
                  const [longitude, latitude] = pointToLngLat(midpoint)

                  return (
                    <MapMarker
                      key={`${connection.id}-label`}
                      longitude={longitude}
                      latitude={latitude}
                      anchor="center"
                      className="pointer-events-none z-[32]"
                    >
                      <MarkerContent className="pointer-events-none cursor-default">
                        <div
                          className={cn(
                            "rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] shadow-[0_6px_16px_rgba(0,0,0,0.45)] backdrop-blur-[2px]",
                            connection.withinRange
                              ? "border-black/45 bg-black/70 text-stone-100"
                              : "border-red-300/55 bg-red-950/78 text-red-100",
                          )}
                        >
                          {label}
                        </div>
                      </MarkerContent>
                    </MapMarker>
                  )
                })()}
              </div>
            ))
          : null}

        {sceneMounted && gatePreviewGuide ? (
          <>
            <MapRoute
              id="gate-preview-radius-base"
              coordinates={circlePolygon(
                gatePreviewGuide.originPosition,
                warlockGateMaxRange,
              ).map(pointToLngLat)}
              color="#09090b"
              width={5}
              opacity={0.24}
              interactive={false}
            />
            <MapRoute
              id="gate-preview-radius"
              coordinates={circlePolygon(
                gatePreviewGuide.originPosition,
                warlockGateMaxRange,
              ).map(pointToLngLat)}
              color={gatePreviewGuide.withinRange ? "#c084fc" : "#f87171"}
              width={2.5}
              opacity={0.9}
              dashArray={[1, 1.8]}
              interactive={false}
            />
            <MapRoute
              id="gate-preview-link"
              coordinates={[
                pointToLngLat(gatePreviewGuide.originPosition),
                pointToLngLat(gatePreviewGuide.previewPosition),
              ]}
              color={gatePreviewGuide.withinRange ? "#c084fc" : "#f87171"}
              width={3}
              opacity={0.92}
              dashArray={[1.1, 1.9]}
              interactive={false}
            />
          </>
        ) : null}

        {sceneMounted
          ? orderedPullOutlines.map(
              ({ pullId, pullNumber, color, outline }) => {
                const center = getPullOutlineCenter(outline)
                if (!center) {
                  return null
                }
                const [longitude, latitude] = pointToLngLat(center)

                return (
                  <MapMarker
                    key={pullId}
                    longitude={longitude}
                    latitude={latitude}
                    anchor="center"
                    className="pointer-events-none z-20"
                  >
                    <MarkerContent className="pointer-events-none cursor-default">
                      <div
                        className="pointer-events-none select-none text-[18px] text-shadow-accent leading-none font-bold [text-shadow:0_1px_0_rgba(0,0,0,0.95),0_0_6px_rgba(0,0,0,0.9),0_0_12px_rgba(0,0,0,0.8)]"
                        style={{ color }}
                      >
                        {pullNumber}
                      </div>
                    </MarkerContent>
                  </MapMarker>
                )
              },
            )
          : null}

        {sceneMounted
          ? route.notes.map((note) => (
              <PlannerNoteMarker
                key={note.id}
                text={note.text}
                position={note.position}
                onContextMenu={handleStaticMarkerContextMenu}
              />
            ))
          : null}

        {sceneMounted
          ? renderedStickers.map((sticker) => (
              <PlannerStickerMarker
                key={sticker.id}
                sticker={sticker}
                invalid={invalidGateStickerIds.has(sticker.id)}
                onContextMenu={(event) =>
                  handleStickerContextMenu(event, sticker)
                }
                onShiftDragMove={handleShiftDragPreview}
                onShiftDragEnd={handleShiftDragSticker}
              />
            ))
          : null}

        {sceneMounted
          ? dungeon.mdt.pois.flatMap((poi) => {
              if (poi.type === "genericItem") {
                return []
              }

              const src = poiIcons[poi.type as keyof typeof poiIcons]
              if (!src) {
                return []
              }

              return (
                <PlannerPoiMarker
                  key={`${poi.type}-${poi.pos[0]}-${poi.pos[1]}`}
                  position={poi.pos}
                  src={src}
                  description={
                    poi.info?.description ||
                    (poi.type === "graveyard" ? "Graveyard" : "Entrance")
                  }
                  onContextMenu={handleStaticMarkerContextMenu}
                />
              )
            })
          : null}
      </SharedMap>

      {mapContextMenu ? (
        <PlannerMapContextMenu
          menuRef={mapContextMenuRef}
          mobSpawn={mapContextMenu.mobSpawn}
          sticker={mapContextMenu.sticker}
          onAddNote={handleOpenAddNoteDialog}
          onDeleteSticker={handleDeleteSticker}
          onEditSticker={handleOpenEditStickerDialog}
          onMoveSticker={handleMoveSticker}
          onMobInfo={handleOpenMobInfoDialog}
          position={mapContextMenu.position}
          x={mapContextMenu.x}
          y={mapContextMenu.y}
        />
      ) : null}

      {activeStickerKind ? (
        <PlannerSelectedStickerTray
          stickerKind={activeStickerKind}
          pendingMove={pendingStickerKind !== null}
          onExit={handleExitStickerMode}
          className="pointer-events-auto absolute left-3 top-24 z-[440] md:left-auto md:right-[calc(26rem+1rem)] md:top-4"
        />
      ) : null}

      {showStickerCursorPreview ? (
        <div
          className="pointer-events-none absolute z-[440]"
          style={{
            left: pointerPreview.x,
            top: pointerPreview.y,
            transform: "translate(-35%, -82%) rotate(-10deg)",
          }}
        >
          <div className="relative">
            <div className="absolute left-1/2 top-full h-5 w-5 -translate-x-1/2 -translate-y-3 rounded-full bg-black/30 blur-md" />
            <div
              className={cn(
                "relative rounded-full border bg-black/65 p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.5)]",
                plannerStickerMeta[activeStickerKind].tone,
              )}
            >
              <img
                src={plannerStickerMeta[activeStickerKind].iconSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="size-10 rounded-full object-cover opacity-95"
              />
            </div>
            <div className="absolute -bottom-1 right-0 rounded-full border border-white/15 bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/85">
              {plannerStickerMeta[activeStickerKind].chipLabel}
            </div>
          </div>
        </div>
      ) : null}

      {showBlockingOverlay && !sceneReady && !mapError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-xs text-muted-foreground">
          {loadingMessage()}
        </div>
      ) : null}

      {pendingStickerMoveId ? (
        <div className="pointer-events-none absolute left-3 bottom-3 z-[430] border border-border/70 bg-card/88 px-3 py-2 text-xs text-foreground shadow-xl backdrop-blur md:left-4 md:bottom-4">
          Picked up{" "}
          {plannerStickerMeta[
            pendingStickerKind ?? "bloodlust"
          ].name.toLowerCase()}
          . Click on the map to place it
          {pendingStickerKind === "warlockGate"
            ? ` within ${warlockGateMaxRange} yd.`
            : "."}
        </div>
      ) : null}

      {mapError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/90 px-4 text-center text-xs text-destructive-foreground">
          {mapError}
        </div>
      ) : null}

      <PlannerNoteDialog
        mobSpawn={
          pendingAnnotation?.kind === "note" ? pendingAnnotation.mobSpawn : null
        }
        stickerKind={
          pendingAnnotation?.kind === "edit-sticker"
            ? pendingAnnotation.stickerKind
            : null
        }
        initialText={
          pendingAnnotation?.kind === "edit-sticker"
            ? pendingAnnotation.text
            : ""
        }
        initialStickerLabelPosition={
          pendingAnnotation?.kind === "edit-sticker"
            ? pendingAnnotation.labelPosition
            : "right"
        }
        open={pendingAnnotation != null}
        position={pendingAnnotation?.position ?? null}
        onSubmit={handleCreateAnnotation}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAnnotation(null)
          }
        }}
        submitLabel={
          pendingAnnotation?.kind === "edit-sticker"
            ? "Save Sticker Text"
            : "Add Note"
        }
        title={
          pendingAnnotation?.kind === "edit-sticker"
            ? `Edit ${plannerStickerMeta[pendingAnnotation.stickerKind].name} Text`
            : "Add Note"
        }
      />

      <PlannerMobInfoDialog
        mobSpawn={infoMobSpawn}
        open={infoMobSpawn != null}
        onOpenChange={(open) => {
          if (!open) {
            setInfoMobSpawn(null)
          }
        }}
      />
    </div>
  )
}
