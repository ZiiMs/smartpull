import type {
  ActiveDungeonAsset,
  getSelectedPullOutline,
  PlannerMapLoadPhase,
} from "@/features/planner/components/planner-map-client"
import type {
  selectActiveRoute,
  selectDrawTool,
  selectMode,
} from "@/features/planner/store/planner-store"
import type { DungeonKey, Point } from "@/features/planner/types"
import { useMap } from "../ui/map"
import {
  usePlannerMapData,
  usePlannerMapInteraction,
  usePlannerMapScene,
  usePlannerMapSceneAsset,
  usePlannerMapZoomScale,
} from "./planner-map-scene-hooks"

function PlannerMapSceneController({
  dungeonKey,
  mode,
  drawTool,
  orderedPullOutlines,
  routeDrawings,
  draftDrawing,
  movePendingSticker,
  addNote,
  placeSticker,
  appendDraftPoint,
  openContextMenu,
  setActiveDungeonAsset,
  setActiveSceneDungeonKey,
  setLoadPhase,
  setMapError,
  setShowBlockingOverlay,
}: {
  dungeonKey: DungeonKey
  mode: ReturnType<typeof selectMode>
  drawTool: ReturnType<typeof selectDrawTool>
  orderedPullOutlines: Array<{
    pullId: string
    color: string
    outline: ReturnType<typeof getSelectedPullOutline>
    selected: boolean
  }>
  routeDrawings: NonNullable<ReturnType<typeof selectActiveRoute>>["drawings"]
  draftDrawing: Point[]
  movePendingSticker?: (point: Point) => boolean
  addNote: (point: Point, text?: string) => void
  placeSticker: (
    kind: Exclude<ReturnType<typeof selectDrawTool>, "line">,
    position: Point,
  ) => void
  appendDraftPoint: (point: Point) => void
  openContextMenu: (payload: {
    clientX: number
    clientY: number
    point: Point
  }) => void
  setActiveDungeonAsset: (value: ActiveDungeonAsset | null) => void
  setActiveSceneDungeonKey: (value: string | null) => void
  setLoadPhase: (value: PlannerMapLoadPhase) => void
  setMapError: (value: string | null) => void
  setShowBlockingOverlay: (value: boolean) => void
}) {
  const { map, isLoaded } = useMap()

  usePlannerMapScene(map, isLoaded)
  usePlannerMapInteraction({
    map,
    isLoaded,
    mode,
    drawTool,
    movePendingSticker,
    addNote,
    placeSticker,
    appendDraftPoint,
    openContextMenu,
  })
  usePlannerMapZoomScale(map, isLoaded)
  usePlannerMapSceneAsset({
    map,
    isLoaded,
    dungeonKey,
    setActiveDungeonAsset,
    setActiveSceneDungeonKey,
    setLoadPhase,
    setMapError,
    setShowBlockingOverlay,
  })
  usePlannerMapData({
    map,
    isLoaded,
    orderedPullOutlines,
    routeDrawings,
    draftDrawing,
  })

  return null
}

export default PlannerMapSceneController
