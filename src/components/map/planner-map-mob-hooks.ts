import {
  buildPlannerMobFeatureCollection,
  darkenPlannerMobColor,
  effectivePlannerMobPixelsPerScaleAtZoom,
  ensurePlannerMobSprite,
  ensurePlannerMobSprites,
  parsePlannerMobSpriteId,
  plannerMobSpriteSize,
  type PlannerMobFeatureCollection,
} from "@/features/planner/lib/mob-rendering"
import type { DungeonDefinition, DungeonKey, SpawnId } from "@/features/planner/types"
import type maplibregl from "maplibre-gl"
import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  MapStyleImageMissingEvent,
} from "maplibre-gl"
import { useEffect, useMemo, useRef } from "react"

const plannerMobSourceId = "planner-mobs"
const plannerMobShadowLayerId = "planner-mobs-shadow"
const plannerMobSelectedHaloLayerId = "planner-mobs-selected-halo"
const plannerMobRingLayerId = "planner-mobs-ring"
const plannerMobBackgroundLayerId = "planner-mobs-background"
const plannerMobPortraitLayerId = "planner-mobs-portrait"
const plannerMobTintLayerId = "planner-mobs-tint"
const plannerMobForceLabelLayerId = "planner-mobs-force-labels"
const plannerMobGroupLabelLayerId = "planner-mobs-group-labels"
const plannerMobHitboxLayerId = "planner-mobs-hitbox"
const defaultMobRingColor = "#0a0a0c"
const defaultSelectedRingColor = darkenPlannerMobColor(defaultMobRingColor)

const emptyPlannerMobFeatureCollection: PlannerMobFeatureCollection = {
  type: "FeatureCollection",
  features: [],
}

function responsivePixelsPerScaleAtZoom(zoom: number) {
  return effectivePlannerMobPixelsPerScaleAtZoom(zoom)
}

function markerRadiusExpression(multiplier = 0.5) {
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    -2,
    ["*", ["get", "markerScale"], responsivePixelsPerScaleAtZoom(-2) * multiplier],
    10,
    ["*", ["get", "markerScale"], responsivePixelsPerScaleAtZoom(10) * multiplier],
    14,
    ["*", ["get", "markerScale"], responsivePixelsPerScaleAtZoom(14) * multiplier],
  ] as maplibregl.ExpressionSpecification
}

function markerTextSizeExpression(labelScaleProperty: "forceLabelScale" | "groupLabelScale") {
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    -2,
    [
      "min",
      [
        "*",
        ["get", "markerScale"],
        ["get", labelScaleProperty],
        responsivePixelsPerScaleAtZoom(-2) * 0.7,
      ],
      254,
    ],
    10,
    [
      "min",
      [
        "*",
        ["get", "markerScale"],
        ["get", labelScaleProperty],
        responsivePixelsPerScaleAtZoom(10) * 0.7,
      ],
      254,
    ],
    14,
    [
      "min",
      [
        "*",
        ["get", "markerScale"],
        ["get", labelScaleProperty],
        responsivePixelsPerScaleAtZoom(14) * 0.7,
      ],
      254,
    ],
  ] as maplibregl.ExpressionSpecification
}

function markerIconSizeExpression(multiplier = 1) {
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    -2,
    ["/", ["*", ["get", "markerScale"], responsivePixelsPerScaleAtZoom(-2) * multiplier], plannerMobSpriteSize],
    10,
    ["/", ["*", ["get", "markerScale"], responsivePixelsPerScaleAtZoom(10) * multiplier], plannerMobSpriteSize],
    14,
    ["/", ["*", ["get", "markerScale"], responsivePixelsPerScaleAtZoom(14) * multiplier], plannerMobSpriteSize],
  ] as maplibregl.ExpressionSpecification
}

function setMobLabelOpacity(
  map: maplibregl.Map,
  modifierMode: PlannerMobLabelMode,
) {
  if (map.getLayer(plannerMobForceLabelLayerId)) {
    map.setPaintProperty(
      plannerMobForceLabelLayerId,
      "text-opacity",
      modifierMode === "ctrl"
        ? 1
        : modifierMode === "alt"
          ? 0
          : [
              "case",
              ["boolean", ["feature-state", "groupHovered"], false],
              1,
              0,
            ],
    )
  }

  if (map.getLayer(plannerMobGroupLabelLayerId)) {
    map.setPaintProperty(
      plannerMobGroupLabelLayerId,
      "text-opacity",
      modifierMode === "alt" ? 1 : 0,
    )
  }
}

function getSpawnIdFromLayerEvent(event: MapLayerMouseEvent) {
  const feature = event.features?.[0]
  const spawnId = feature?.properties?.spawnId

  return typeof spawnId === "string" ? spawnId : null
}

function logPlannerMobSceneError(stage: string, error: unknown) {
  console.error("[planner-mobs]", stage, {
    error: error instanceof Error ? error.message : String(error),
  })
}

function setHoveredGroupFeatureState(
  map: maplibregl.Map,
  groupToSpawnIds: ReadonlyMap<number, SpawnId[]>,
  group: number | null,
  hovered: boolean,
) {
  if (group == null) {
    return
  }

  const spawnIds = groupToSpawnIds.get(group)
  if (!spawnIds) {
    return
  }

  for (const spawnId of spawnIds) {
    map.setFeatureState(
      {
        source: plannerMobSourceId,
        id: spawnId,
      },
      {
        groupHovered: hovered,
      },
    )
  }
}

export type PlannerMobLabelMode = "default" | "ctrl" | "alt"

export function usePlannerMobScene({
  dungeon,
  dungeonKey,
  hoveredGroup,
  isLoaded,
  map,
  modifierMode,
  openMobContextMenu,
  pullColorBySpawn,
  sceneMounted,
  selectedSpawnIds,
  setHoveredSpawnId,
  toggleSpawn,
}: {
  dungeon: DungeonDefinition
  dungeonKey: DungeonKey
  hoveredGroup: number | null
  isLoaded: boolean
  map: maplibregl.Map | null
  modifierMode: PlannerMobLabelMode
  openMobContextMenu: (payload: {
    clientX: number
    clientY: number
    spawnId: SpawnId
  }) => void
  pullColorBySpawn: ReadonlyMap<SpawnId, string>
  sceneMounted: boolean
  selectedSpawnIds: ReadonlySet<SpawnId>
  setHoveredSpawnId: (spawnId: SpawnId | null) => void
  toggleSpawn: (
    spawnId: SpawnId,
    options?: {
      individual?: boolean
    },
  ) => void
}) {
  const groupToSpawnIds = useMemo(() => {
    const next = new globalThis.Map<number, SpawnId[]>()

    for (const { spawn } of dungeon.mobSpawnsList) {
      if (spawn.group == null) {
        continue
      }

      const currentGroupSpawnIds = next.get(spawn.group)
      if (currentGroupSpawnIds) {
        currentGroupSpawnIds.push(spawn.id)
      } else {
        next.set(spawn.group, [spawn.id])
      }
    }

    return next
  }, [dungeon.mobSpawnsList])

  const mobFeatures = useMemo(
    () =>
      sceneMounted
        ? buildPlannerMobFeatureCollection({
            dungeonKey,
            mobSpawns: dungeon.mobSpawnsList,
            pullColorBySpawn,
            selectedSpawnIds,
          })
        : emptyPlannerMobFeatureCollection,
    [
      dungeon.mobSpawnsList,
      dungeonKey,
      pullColorBySpawn,
      sceneMounted,
      selectedSpawnIds,
    ],
  )

  const callbacksRef = useRef({
    openMobContextMenu,
    setHoveredSpawnId,
    toggleSpawn,
  })
  callbacksRef.current = {
    openMobContextMenu,
    setHoveredSpawnId,
    toggleSpawn,
  }

  const previousHoveredGroupRef = useRef<number | null>(null)

  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    try {
      if (!map.getSource(plannerMobSourceId)) {
        map.addSource(plannerMobSourceId, {
          type: "geojson",
          data: emptyPlannerMobFeatureCollection,
        })
      }

      if (!map.getLayer(plannerMobShadowLayerId)) {
        map.addLayer({
          id: plannerMobShadowLayerId,
          type: "circle",
          source: plannerMobSourceId,
          paint: {
            "circle-blur": 0.6,
            "circle-color": "#000000",
            "circle-opacity": 0.58,
            "circle-radius": markerRadiusExpression(0.72),
          },
        })
      }

      if (!map.getLayer(plannerMobSelectedHaloLayerId)) {
        map.addLayer({
          id: plannerMobSelectedHaloLayerId,
          type: "circle",
          source: plannerMobSourceId,
          paint: {
            "circle-color": ["coalesce", ["get", "selectedRingColor"], defaultSelectedRingColor],
            "circle-opacity": [
              "case",
              ["boolean", ["get", "selected"], false],
              0.98,
              0,
            ],
            "circle-radius": markerRadiusExpression(0.6),
          },
        })
      }

      if (!map.getLayer(plannerMobRingLayerId)) {
        map.addLayer({
          id: plannerMobRingLayerId,
          type: "circle",
          source: plannerMobSourceId,
          paint: {
            "circle-color": ["coalesce", ["get", "pullColor"], defaultMobRingColor],
            "circle-opacity": 1,
            "circle-radius": markerRadiusExpression(0.505),
          },
        })
      }

      if (!map.getLayer(plannerMobBackgroundLayerId)) {
        map.addLayer({
          id: plannerMobBackgroundLayerId,
          type: "circle",
          source: plannerMobSourceId,
          paint: {
            "circle-color": "#0a0a0c",
            "circle-opacity": 0,
            "circle-radius": markerRadiusExpression(0.52),
          },
        })
      }

      if (!map.getLayer(plannerMobPortraitLayerId)) {
        map.addLayer({
          id: plannerMobPortraitLayerId,
          type: "symbol",
          source: plannerMobSourceId,
          layout: {
          "icon-allow-overlap": true,
          "icon-anchor": "center",
          "icon-ignore-placement": true,
          "icon-image": ["get", "spriteId"],
          "icon-size": markerIconSizeExpression(0.92),
          "symbol-z-order": "source",
        },
      })
      }

      if (!map.getLayer(plannerMobTintLayerId)) {
        map.addLayer({
          id: plannerMobTintLayerId,
          type: "circle",
          source: plannerMobSourceId,
          paint: {
            "circle-color": ["coalesce", ["get", "pullColor"], "#000000"],
            "circle-opacity": [
              "case",
              ["!=", ["coalesce", ["get", "pullColor"], ""], ""],
              0.22,
              0,
            ],
            "circle-radius": markerRadiusExpression(0.48),
          },
        })
      }

      if (!map.getLayer(plannerMobForceLabelLayerId)) {
        map.addLayer({
          id: plannerMobForceLabelLayerId,
          type: "symbol",
          source: plannerMobSourceId,
          layout: {
            "symbol-z-order": "source",
            "text-allow-overlap": true,
            "text-anchor": "center",
            "text-field": ["get", "forceLabel"],
            "text-font": ["Noto Sans Bold"],
            "text-ignore-placement": true,
            "text-max-width": 3,
            "text-size": markerTextSizeExpression("forceLabelScale"),
        },
        paint: {
            "text-color": "#ffffff",
            "text-halo-blur": 0.3,
            "text-halo-color": "#000000",
            "text-halo-width": 1.8,
            "text-opacity": 0,
          },
        })
      }

      if (!map.getLayer(plannerMobGroupLabelLayerId)) {
        map.addLayer({
          id: plannerMobGroupLabelLayerId,
          type: "symbol",
          source: plannerMobSourceId,
          layout: {
            "symbol-z-order": "source",
            "text-allow-overlap": true,
            "text-anchor": "center",
            "text-field": ["get", "groupLabel"],
            "text-font": ["Noto Sans Bold"],
            "text-ignore-placement": true,
            "text-max-width": 3,
            "text-size": markerTextSizeExpression("groupLabelScale"),
        },
        paint: {
            "text-color": "#ffffff",
            "text-halo-blur": 0.3,
            "text-halo-color": "#000000",
            "text-halo-width": 1.8,
            "text-opacity": 0,
          },
        })
      }

      if (!map.getLayer(plannerMobHitboxLayerId)) {
        map.addLayer({
          id: plannerMobHitboxLayerId,
          type: "circle",
          source: plannerMobSourceId,
          paint: {
            "circle-color": "#000000",
            "circle-opacity": 0,
            "circle-radius": markerRadiusExpression(0.74),
          },
        })
      }

      setMobLabelOpacity(map, modifierMode)
    } catch (error) {
      logPlannerMobSceneError("init", error)
    }
  }, [isLoaded, map, modifierMode])

  useEffect(() => {
    if (!map || !isLoaded || !sceneMounted) {
      callbacksRef.current.setHoveredSpawnId(null)
      return
    }

    let cancelled = false

    void ensurePlannerMobSprites(map, dungeonKey, dungeon.mobSpawnsList).catch(
      (error) => {
        logPlannerMobSceneError("sprites", error)
        if (!cancelled) {
          callbacksRef.current.setHoveredSpawnId(null)
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [dungeon.mobSpawnsList, dungeonKey, isLoaded, map, sceneMounted])

  useEffect(() => {
    if (!map || !isLoaded || !sceneMounted) {
      return
    }

    const mobIds = new Set(dungeon.mobSpawnsList.map(({ mob }) => mob.id))

    const handleStyleImageMissing = (event: MapStyleImageMissingEvent) => {
      const parsedSpriteId = parsePlannerMobSpriteId(event.id)
      if (
        !parsedSpriteId ||
        parsedSpriteId.dungeonKey !== dungeonKey ||
        !mobIds.has(parsedSpriteId.mobId)
      ) {
        return
      }

      void ensurePlannerMobSprite(
        map,
        parsedSpriteId.dungeonKey,
        parsedSpriteId.mobId,
      ).catch((error) => {
        logPlannerMobSceneError("style-image-missing", error)
      })
    }

    map.on("styleimagemissing", handleStyleImageMissing)

    return () => {
      map.off("styleimagemissing", handleStyleImageMissing)
    }
  }, [dungeon.mobSpawnsList, dungeonKey, isLoaded, map, sceneMounted])

  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    const source = map.getSource(plannerMobSourceId) as GeoJSONSource | undefined
    if (!source) {
      return
    }

    try {
      source.setData(mobFeatures)
    } catch (error) {
      logPlannerMobSceneError("set-data", error)
    }
  }, [isLoaded, map, mobFeatures])

  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    setMobLabelOpacity(map, modifierMode)
  }, [isLoaded, map, modifierMode])

  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    const previousHoveredGroup = previousHoveredGroupRef.current
    setHoveredGroupFeatureState(map, groupToSpawnIds, previousHoveredGroup, false)

    const nextHoveredGroup = sceneMounted ? hoveredGroup : null
    setHoveredGroupFeatureState(map, groupToSpawnIds, nextHoveredGroup, true)
    previousHoveredGroupRef.current = nextHoveredGroup
  }, [groupToSpawnIds, hoveredGroup, isLoaded, map, mobFeatures, sceneMounted])

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(plannerMobHitboxLayerId)) {
      return
    }

    const handleMouseMove = (event: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer"
      callbacksRef.current.setHoveredSpawnId(getSpawnIdFromLayerEvent(event))
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ""
      callbacksRef.current.setHoveredSpawnId(null)
    }

    const handleClick = (event: MapLayerMouseEvent) => {
      const spawnId = getSpawnIdFromLayerEvent(event)
      if (!spawnId) {
        return
      }

      event.preventDefault()
      event.originalEvent.preventDefault()
      event.originalEvent.stopPropagation()
      callbacksRef.current.toggleSpawn(spawnId, {
        individual: event.originalEvent.ctrlKey || event.originalEvent.metaKey,
      })
    }

    const handleContextMenu = (event: MapLayerMouseEvent) => {
      const spawnId = getSpawnIdFromLayerEvent(event)
      if (!spawnId) {
        return
      }

      event.preventDefault()
      event.originalEvent.preventDefault()
      event.originalEvent.stopPropagation()
      callbacksRef.current.openMobContextMenu({
        clientX: event.originalEvent.clientX,
        clientY: event.originalEvent.clientY,
        spawnId,
      })
    }

    map.on("mousemove", plannerMobHitboxLayerId, handleMouseMove)
    map.on("mouseleave", plannerMobHitboxLayerId, handleMouseLeave)
    map.on("click", plannerMobHitboxLayerId, handleClick)
    map.on("contextmenu", plannerMobHitboxLayerId, handleContextMenu)

    return () => {
      map.getCanvas().style.cursor = ""
      map.off("mousemove", plannerMobHitboxLayerId, handleMouseMove)
      map.off("mouseleave", plannerMobHitboxLayerId, handleMouseLeave)
      map.off("click", plannerMobHitboxLayerId, handleClick)
      map.off("contextmenu", plannerMobHitboxLayerId, handleContextMenu)
    }
  }, [isLoaded, map])
}
