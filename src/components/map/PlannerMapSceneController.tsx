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
import type {
  DungeonDefinition,
  DungeonKey,
  Point,
  SpawnId,
} from "@/features/planner/types"
import { useMap } from "../ui/map"
import {
  type PlannerMobLabelMode,
  usePlannerMobScene,
} from "./planner-map-mob-hooks"
import {
  usePlannerMapData,
  usePlannerMapInteraction,
  usePlannerMapScene,
  usePlannerMapSceneAsset,
} from "./planner-map-scene-hooks"

function PlannerMapSceneController({
  dungeon,
  dungeonKey,
  hoveredGroup,
  mode,
  modifierMode,
  openMobContextMenu,
  drawTool,
  orderedPullOutlines,
  pullColorBySpawn,
  routeDrawings,
  sceneMounted,
  selectedSpawnIds,
  setHoveredSpawnId,
  draftDrawing,
  movePendingSticker,
  addNote,
  placeSticker,
  appendDraftPoint,
  openContextMenu,
  setPointerPoint,
  setActiveDungeonAsset,
  setActiveSceneDungeonKey,
  setLoadPhase,
  setMapError,
  setShowBlockingOverlay,
  toggleSpawn,
}: {
  dungeon: DungeonDefinition
  dungeonKey: DungeonKey
  hoveredGroup: number | null
  mode: ReturnType<typeof selectMode>
  modifierMode: PlannerMobLabelMode
  openMobContextMenu: (payload: {
    clientX: number
    clientY: number
    spawnId: SpawnId
  }) => void
  drawTool: ReturnType<typeof selectDrawTool>
  orderedPullOutlines: Array<{
    pullId: string
    color: string
    outline: ReturnType<typeof getSelectedPullOutline>
    selected: boolean
  }>
  pullColorBySpawn: ReadonlyMap<SpawnId, string>
  routeDrawings: NonNullable<ReturnType<typeof selectActiveRoute>>["drawings"]
  sceneMounted: boolean
  selectedSpawnIds: ReadonlySet<SpawnId>
  setHoveredSpawnId: (spawnId: SpawnId | null) => void
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
  setPointerPoint?: (point: Point | null) => void
  setActiveDungeonAsset: (value: ActiveDungeonAsset | null) => void
  setActiveSceneDungeonKey: (value: string | null) => void
  setLoadPhase: (value: PlannerMapLoadPhase) => void
  setMapError: (value: string | null) => void
  setShowBlockingOverlay: (value: boolean) => void
  toggleSpawn: (spawnId: SpawnId, options?: { individual?: boolean }) => void
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
    setPointerPoint,
  })
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
  usePlannerMobScene({
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
  })

  return null
}

export default PlannerMapSceneController
