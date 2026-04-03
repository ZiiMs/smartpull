export type DungeonKey =
  | "aa"
  | "cavns"
  | "magi"
  | "pit"
  | "seat"
  | "sky"
  | "wind"
  | "xenas"

export type Point = [number, number]

export type SpawnId = string

export type MdtSpell = {
  id: number
  attributes: string[]
}

export type Spawn = {
  id: SpawnId
  group: number | null
  idx: number
  pos: Point
  scale?: number | null
  patrol?: Point[]
}

export type Mob = {
  id: number
  enemyIndex: number
  name: string
  count: number
  health: number
  creatureType: string
  scale: number
  isBoss: boolean
  stealthDetect?: boolean
  characteristics: string[]
  spells: MdtSpell[]
  spawns: Spawn[]
}

export type PointOfInterest = {
  type: "dungeonEntrance" | "graveyard" | "genericItem"
  pos: Point
  sizeMult?: number
  info?: {
    description: string | null
    texture: number
    spellId: number
    size: number
  }
}

export type MdtDungeon = {
  dungeonIndex: number
  totalCount: number
  enemies: Mob[]
  pois: PointOfInterest[]
}

export type MobSpawn = {
  mob: Mob
  spawn: Spawn
}

export type PlannerPull = {
  id: string
  label: string
  color: string
  spawns: SpawnId[]
}

export type PlannerNote = {
  id: string
  text: string
  position: Point
}

export type PlannerDrawing = {
  id: string
  color: string
  weight: number
  points: Point[]
}

export type PlannerStickerKind = "bloodlust" | "warlockGate" | "stealth"

export type PlannerSticker = {
  id: string
  kind: PlannerStickerKind
  position: Point
  text?: string
}

export type PlannerRoute = {
  id: string
  schemaVersion: number
  name: string
  dungeonKey: DungeonKey
  pulls: PlannerPull[]
  notes: PlannerNote[]
  drawings: PlannerDrawing[]
  stickers: PlannerSticker[]
  createdAt: string
  updatedAt: string
  shareId?: string
}

export type DungeonDefinition = {
  key: DungeonKey
  name: string
  shortName: string
  mapPalette: [string, string]
  icon: string
  mdt: MdtDungeon
  mobSpawns: Record<SpawnId, MobSpawn>
  mobSpawnsList: MobSpawn[]
}

export type PlannerMode = "pulls" | "notes" | "draw"

export type PlannerDrawTool = "line" | PlannerStickerKind

export type PlannerPresent = {
  seasonLabel: string
  dungeonKey: DungeonKey
  routes: PlannerRoute[]
  activeRouteId: string
  selectedPullId: string
  mode: PlannerMode
  drawTool: PlannerDrawTool
  draftDrawing: Point[]
}

export type PlannerSnapshot = {
  past: PlannerPresent[]
  present: PlannerPresent
  future: PlannerPresent[]
}

export type MdtPull = {
  color: string
  [enemyIndex: number]: number[] | string
}

export type MdtNote = {
  d: [number, number, number, true, string]
  n: true
}

export type MdtPolygon = {
  d: [number, 1, number, true, string, -8, true]
  l: string[]
}

export type MdtRoute = {
  text: string
  week: number
  difficulty: number
  uid: string
  value: {
    currentPull: number
    currentSublevel: number
    currentDungeonIdx: number
    selection: number[]
    pulls: MdtPull[]
  }
  objects: MdtNote[] | MdtPolygon[] | Record<number, MdtNote | MdtPolygon>
}
