import type {
  ActiveDungeonAsset,
  getSelectedPullOutline,
  PlannerMapLoadPhase,
} from "@/features/planner/components/planner-map-client"
import {
  createDungeonMapCacheKey,
  dungeonImageCoordinates,
  hasStitchedDungeonMapInMemory,
  lngLatToPoint,
  mapBounds,
  pointToLngLat,
  stitchDungeonMap,
} from "@/features/planner/lib/map"
import type {
  selectActiveRoute,
  selectMode,
} from "@/features/planner/store/planner-store"
import type { DungeonKey, Point } from "@/features/planner/types"
import type maplibregl from "maplibre-gl"
import type { GeoJSONSource, ImageSource, LngLatBoundsLike } from "maplibre-gl"
import { useEffect } from "react"

const pullOutlineSourceId = "planner-pull-outlines"
const pullOutlineFillLayerId = "planner-pull-outlines-fill"
const pullOutlineLineLayerId = "planner-pull-outlines-line"
const drawingSourceId = "planner-drawings"
const drawingLayerId = "planner-drawings"
const draftDrawingSourceId = "planner-draft-drawing"
const draftDrawingLayerId = "planner-draft-drawing"
const dungeonImageSourceId = "planner-dungeon-image"
const dungeonImageLayerId = "planner-dungeon-image-layer"
const portraitFallbackSrc = "/images/markers/skull.png"

function updateDungeonImageSource(activeMap: maplibregl.Map, url: string) {
  const source = activeMap.getSource(dungeonImageSourceId) as
    | ImageSource
    | undefined

  if (!source) {
    throw new Error("Missing dungeon image source.")
  }

  source.updateImage({
    url,
    coordinates: dungeonImageCoordinates(),
  })
}

export function usePlannerMapScene(
  map: maplibregl.Map | null,
  isLoaded: boolean,
) {
  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    if (!map.getSource(dungeonImageSourceId)) {
      map.addSource(dungeonImageSourceId, {
        type: "image",
        url: portraitFallbackSrc,
        coordinates: dungeonImageCoordinates(),
      })
    }

    if (!map.getLayer(dungeonImageLayerId)) {
      map.addLayer({
        id: dungeonImageLayerId,
        type: "raster",
        source: dungeonImageSourceId,
        paint: {
          "raster-fade-duration": 0,
        },
      })
    }

    if (!map.getSource(pullOutlineSourceId)) {
      map.addSource(pullOutlineSourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
    }

    if (!map.getLayer(pullOutlineFillLayerId)) {
      map.addLayer({
        id: pullOutlineFillLayerId,
        type: "fill",
        source: pullOutlineSourceId,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["get", "fillOpacity"],
        },
      })
    }

    if (!map.getLayer(pullOutlineLineLayerId)) {
      map.addLayer({
        id: pullOutlineLineLayerId,
        type: "line",
        source: pullOutlineSourceId,
        paint: {
          "line-color": ["get", "color"],
          "line-opacity": ["get", "lineOpacity"],
          "line-width": ["get", "lineWidth"],
        },
      })
    }

    if (!map.getSource(drawingSourceId)) {
      map.addSource(drawingSourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
    }

    if (!map.getLayer(drawingLayerId)) {
      map.addLayer({
        id: drawingLayerId,
        type: "line",
        source: drawingSourceId,
        paint: {
          "line-color": ["get", "color"],
          "line-opacity": ["get", "opacity"],
          "line-width": ["get", "width"],
        },
      })
    }

    if (!map.getSource(draftDrawingSourceId)) {
      map.addSource(draftDrawingSourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
    }

    if (!map.getLayer(draftDrawingLayerId)) {
      map.addLayer({
        id: draftDrawingLayerId,
        type: "line",
        source: draftDrawingSourceId,
        paint: {
          "line-color": "#f8fafc",
          "line-opacity": 0.8,
          "line-width": 3,
          "line-dasharray": [2, 1.333],
        },
      })
    }

    map.touchZoomRotate.disableRotation()
  }, [isLoaded, map])
}

export function usePlannerMapInteraction({
  map,
  isLoaded,
  mode,
  addNote,
  appendDraftPoint,
  openContextMenu,
}: {
  map: maplibregl.Map | null
  isLoaded: boolean
  mode: ReturnType<typeof selectMode>
  addNote: (point: Point, text?: string) => void
  appendDraftPoint: (point: Point) => void
  openContextMenu: (payload: {
    clientX: number
    clientY: number
    point: Point
  }) => void
}) {
  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const point = lngLatToPoint(event.lngLat)

      if (mode === "notes") {
        addNote(point)
      } else if (mode === "draw") {
        appendDraftPoint(point)
      }
    }

    const handleMapContextMenu = (event: maplibregl.MapMouseEvent) => {
      if (event.defaultPrevented) {
        return
      }

      event.preventDefault()
      const point = lngLatToPoint(event.lngLat)
      const originalEvent = event.originalEvent

      openContextMenu({
        clientX: originalEvent.clientX,
        clientY: originalEvent.clientY,
        point,
      })
    }

    map.on("click", handleMapClick)
    map.on("contextmenu", handleMapContextMenu)

    return () => {
      map.off("click", handleMapClick)
      map.off("contextmenu", handleMapContextMenu)
    }
  }, [addNote, appendDraftPoint, isLoaded, map, mode, openContextMenu])
}

export function usePlannerMapSceneAsset({
  map,
  isLoaded,
  dungeonKey,
  setActiveDungeonAsset,
  setActiveSceneDungeonKey,
  setLoadPhase,
  setMapError,
  setShowBlockingOverlay,
}: {
  map: maplibregl.Map | null
  isLoaded: boolean
  dungeonKey: DungeonKey
  setActiveDungeonAsset: (value: ActiveDungeonAsset | null) => void
  setActiveSceneDungeonKey: (value: string | null) => void
  setLoadPhase: (value: PlannerMapLoadPhase) => void
  setMapError: (value: string | null) => void
  setShowBlockingOverlay: (value: boolean) => void
}) {
  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    let cancelled = false
    const hasMemoryAsset = hasStitchedDungeonMapInMemory(dungeonKey)
    const liveMap = map

    setMapError(null)
    setActiveDungeonAsset(null)
    setActiveSceneDungeonKey(null)
    setLoadPhase(hasMemoryAsset ? "switching-scene" : "loading-assets")
    setShowBlockingOverlay(!hasMemoryAsset)

    async function loadDungeonScene() {
      try {
        const asset = await stitchDungeonMap(dungeonKey)

        if (cancelled) {
          return
        }

        updateDungeonImageSource(liveMap, asset.url)
        liveMap.fitBounds(mapBounds as LngLatBoundsLike, {
          animate: false,
          padding: 0,
        })
        setActiveDungeonAsset({
          cacheKey: createDungeonMapCacheKey(dungeonKey),
          source: asset.source,
        })
        setActiveSceneDungeonKey(dungeonKey)
        setLoadPhase("ready")
        setShowBlockingOverlay(false)
      } catch (error) {
        if (cancelled) {
          return
        }

        setMapError(
          error instanceof Error
            ? error.message
            : "Could not load planner map.",
        )
        setLoadPhase("ready")
        setShowBlockingOverlay(false)
      }
    }

    void loadDungeonScene()

    return () => {
      cancelled = true
    }
  }, [
    dungeonKey,
    isLoaded,
    map,
    setActiveDungeonAsset,
    setActiveSceneDungeonKey,
    setLoadPhase,
    setMapError,
    setShowBlockingOverlay,
  ])
}

export function usePlannerMapData({
  map,
  isLoaded,
  orderedPullOutlines,
  routeDrawings,
  draftDrawing,
}: {
  map: maplibregl.Map | null
  isLoaded: boolean
  orderedPullOutlines: Array<{
    pullId: string
    color: string
    outline: ReturnType<typeof getSelectedPullOutline>
    selected: boolean
  }>
  routeDrawings: NonNullable<ReturnType<typeof selectActiveRoute>>["drawings"]
  draftDrawing: Point[]
}) {
  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    const source = map.getSource(pullOutlineSourceId) as
      | GeoJSONSource
      | undefined

    if (!source) {
      return
    }

    source.setData({
      type: "FeatureCollection",
      features: orderedPullOutlines.flatMap(
        ({ pullId, color, outline, selected }) => {
          if (!outline?.hull?.length) {
            return []
          }

          const ring = outline.hull.map(pointToLngLat)
          const first = ring[0]
          const closedRing = first ? [...ring, first] : ring

          return [
            {
              type: "Feature",
              id: pullId,
              properties: {
                color,
                fillOpacity: selected ? 0.5 : 0.35,
                lineOpacity: selected ? 0.9 : 0.5,
                lineWidth: selected ? 4 : 2.5,
              },
              geometry: {
                type: "Polygon",
                coordinates: [closedRing],
              },
            },
          ]
        },
      ),
    })
  }, [isLoaded, map, orderedPullOutlines])

  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    const source = map.getSource(drawingSourceId) as GeoJSONSource | undefined

    if (!source) {
      return
    }

    source.setData({
      type: "FeatureCollection",
      features: routeDrawings.map((drawing) => ({
        type: "Feature",
        properties: {
          color: drawing.color,
          width: drawing.weight,
          opacity: 0.9,
        },
        geometry: {
          type: "LineString",
          coordinates: drawing.points.map(pointToLngLat),
        },
      })),
    })
  }, [isLoaded, map, routeDrawings])

  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    const source = map.getSource(draftDrawingSourceId) as
      | GeoJSONSource
      | undefined

    if (!source) {
      return
    }

    source.setData({
      type: "FeatureCollection",
      features:
        draftDrawing.length > 1
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: draftDrawing.map(pointToLngLat),
                },
              },
            ]
          : [],
    })
  }, [draftDrawing, isLoaded, map])
}
