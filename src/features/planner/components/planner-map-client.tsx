import PlannerMapSceneController from "@/components/map/PlannerMapSceneController"
import PlannerMobMarker from "@/components/map/PlannerMobMarker"
import PlannerNoteMarker from "@/components/map/PlannerNoteMarker"
import PlannerPoiMarker from "@/components/map/PlannerPoiMarker"
import PlannerStickerMarker from "@/components/map/PlannerStickerMarker"
import { MapMarker, MarkerContent, Map as SharedMap } from "@/components/ui/map"
import { dungeons } from "@/features/planner/data/dungeons"
import { PlannerMapContextMenu } from "@/features/planner/components/planner-map-context-menu"
import { PlannerMobInfoDialog } from "@/features/planner/components/planner-mob-info-dialog"
import { PlannerNoteDialog } from "@/features/planner/components/planner-note-dialog"
import { plannerStickerMeta } from "@/features/planner/lib/stickers"
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
import type { MobSpawn, PlannerSticker, Point } from "@/features/planner/types"
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
      kind: "sticker"
      stickerKind: PlannerSticker["kind"]
      position: Point
    }

const emptyHoveredMob = {
  group: null,
  spawnId: null,
} as const

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
  const toggleSpawn = usePlannerStore((state) => state.toggleSpawn)
  const appendDraftPoint = usePlannerStore((state) => state.appendDraftPoint)
  const addNote = usePlannerStore((state) => state.addNote)
  const addSticker = usePlannerStore((state) => state.addSticker)
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
  const mapRootRef = useRef<HTMLDivElement | null>(null)
  const hoveredMobRef = useRef<{
    group: number | null
    spawnId: string | null
  }>(emptyHoveredMob)
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

  function loadingMessage() {
    if (loadPhase === "switching-scene") {
      return "Switching dungeon..."
    }

    return "Loading planner surface..."
  }

  const setHoveredGroupState = useCallback(
    (group: number | null, hovered: boolean) => {
      if (group == null) {
        return
      }

      const root = mapRootRef.current
      if (!root) {
        return
      }

      const markerElements = root.querySelectorAll<HTMLElement>(
        `[data-planner-mob-group="${group}"]`,
      )

      for (const markerElement of markerElements) {
        if (hovered) {
          markerElement.dataset.groupHovered = "true"
        } else {
          delete markerElement.dataset.groupHovered
        }
      }
    },
    [],
  )

  const handleMobHoverStart = useCallback(
    (spawnId: string, group: number | null) => {
      const currentHoveredMob = hoveredMobRef.current
      if (
        currentHoveredMob.spawnId === spawnId &&
        currentHoveredMob.group === group
      ) {
        return
      }

      setHoveredGroupState(currentHoveredMob.group, false)
      hoveredMobRef.current = { spawnId, group }
      setHoveredGroupState(group, true)
    },
    [setHoveredGroupState],
  )

  const handleMobHoverEnd = useCallback(
    (spawnId: string) => {
      const currentHoveredMob = hoveredMobRef.current
      if (currentHoveredMob.spawnId !== spawnId) {
        return
      }

      setHoveredGroupState(currentHoveredMob.group, false)
      hoveredMobRef.current = emptyHoveredMob
    },
    [setHoveredGroupState],
  )

  useEffect(() => {
    const cancelIdle = queueIdleTask(() => {
      void warmDungeonMapAssets(dungeons.map((item) => item.key))
    })

    return cancelIdle
  }, [])

  useEffect(() => {
    function applyModifierState(altPressed: boolean, ctrlPressed: boolean) {
      const root = mapRootRef.current
      if (!root) {
        return
      }

      root.dataset.plannerMobModifier = ctrlPressed
        ? "ctrl"
        : altPressed
          ? "alt"
          : "default"
    }

    function syncModifierKeys(event: KeyboardEvent) {
      applyModifierState(event.altKey, event.ctrlKey || event.metaKey)
    }

    function resetModifierKeys() {
      applyModifierState(false, false)
    }

    applyModifierState(false, false)
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
    if (!dungeon.key) {
      return
    }

    setHoveredGroupState(hoveredMobRef.current.group, false)
    hoveredMobRef.current = emptyHoveredMob
  }, [dungeon.key, setHoveredGroupState])

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

  const handleMobContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, mobSpawn: MobSpawn) => {
      openMarkerContextMenu(event, mobSpawn.spawn.pos, mobSpawn)
    },
    [openMarkerContextMenu],
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

      moveSticker(pendingStickerMoveId, point)
      setPendingStickerMoveId(null)
      return true
    },
    [moveSticker, pendingStickerMoveId],
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
    (text: string) => {
      if (!pendingAnnotation) {
        return
      }

      if (pendingAnnotation.kind === "note") {
        addNote(pendingAnnotation.position, text)
      } else {
        addSticker(
          pendingAnnotation.stickerKind,
          pendingAnnotation.position,
          text,
        )
      }

      setPendingAnnotation(null)
    },
    [addNote, addSticker, pendingAnnotation],
  )

  const handlePlaceSticker = useCallback(
    (kind: PlannerSticker["kind"], position: Point) => {
      setPendingAnnotation({
        kind: "sticker",
        stickerKind: kind,
        position,
      })
    },
    [],
  )

  const handleOpenMobInfoDialog = useCallback(() => {
    if (!mapContextMenu?.mobSpawn) {
      return
    }

    setInfoMobSpawn(mapContextMenu.mobSpawn)
    closeMapContextMenu()
  }, [closeMapContextMenu, mapContextMenu])

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
      ref={mapRootRef}
      className="relative h-full w-full bg-background"
      data-planner-mob-modifier="default"
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
        touchPitch={false}
      >
        <PlannerMapSceneController
          dungeonKey={dungeon.key}
          mode={mode}
          drawTool={drawTool}
          orderedPullOutlines={orderedPullOutlines}
          routeDrawings={route.drawings}
          draftDrawing={draftDrawing}
          movePendingSticker={handlePlaceMovedSticker}
          addNote={addNote}
          placeSticker={handlePlaceSticker}
          appendDraftPoint={appendDraftPoint}
          openContextMenu={openMapContextMenu}
          setActiveDungeonAsset={setActiveDungeonAsset}
          setActiveSceneDungeonKey={setActiveSceneDungeonKey}
          setLoadPhase={setLoadPhase}
          setMapError={setMapError}
          setShowBlockingOverlay={setShowBlockingOverlay}
        />

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
          ? route.stickers.map((sticker) => (
              <PlannerStickerMarker
                key={sticker.id}
                sticker={sticker}
                onContextMenu={(event) =>
                  handleStickerContextMenu(event, sticker)
                }
                onShiftClick={(targetSticker) =>
                  setPendingStickerMoveId(targetSticker.id)
                }
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

        {sceneMounted
          ? dungeon.mobSpawnsList.map((mobSpawn) => {
              const spawnId = mobSpawn.spawn.id
              return (
                <PlannerMobMarker
                  key={spawnId}
                  mobSpawn={mobSpawn}
                  pullColor={routeVisualState.pullColorBySpawn.get(spawnId)}
                  isSelected={routeVisualState.selectedSpawnIds.has(spawnId)}
                  pullIndex={routeVisualState.pullIndexBySpawn.get(spawnId)}
                  onHoverStart={handleMobHoverStart}
                  onHoverEnd={handleMobHoverEnd}
                  onContextMenu={handleMobContextMenu}
                  toggleSpawn={toggleSpawn}
                  totalEnemyForces={dungeon.mdt.totalCount}
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
          onMoveSticker={handleMoveSticker}
          onMobInfo={handleOpenMobInfoDialog}
          position={mapContextMenu.position}
          x={mapContextMenu.x}
          y={mapContextMenu.y}
        />
      ) : null}

      {showBlockingOverlay && !sceneReady && !mapError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-xs text-muted-foreground">
          {loadingMessage()}
        </div>
      ) : null}

      {pendingStickerMoveId ? (
        <div className="pointer-events-none absolute left-3 bottom-3 z-[430] border border-border/70 bg-card/88 px-3 py-2 text-xs text-foreground shadow-xl backdrop-blur md:left-4 md:bottom-4">
          Shift-click picked up{" "}
          {plannerStickerMeta[
            route.stickers.find((item) => item.id === pendingStickerMoveId)
              ?.kind ?? "bloodlust"
          ].name.toLowerCase()}
          . Click on the map to place it.
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
          pendingAnnotation?.kind === "sticker"
            ? pendingAnnotation.stickerKind
            : null
        }
        open={pendingAnnotation != null}
        position={pendingAnnotation?.position ?? null}
        onCreateNote={handleCreateAnnotation}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAnnotation(null)
          }
        }}
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
