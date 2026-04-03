import { create } from "zustand"

import {
  dungeons,
  dungeonsByKey,
  seasonLabel,
} from "@/features/planner/data/dungeons"
import { createId } from "@/features/planner/lib/ids"
import { getPullColor } from "@/features/planner/lib/pull-colors"
import type {
  PlannerDrawTool,
  DungeonKey,
  PlannerMode,
  PlannerPresent,
  PlannerPull,
  PlannerRoute,
  PlannerSnapshot,
  Point,
  SpawnId,
} from "@/features/planner/types"

const storageKey = "smart-route-planner-v1"
let persistTimer: number | null = null
let pendingPersistPresent: PlannerPresent | null = null

function createPull(label: string, color: string): PlannerPull {
  return {
    id: createId("pull"),
    label,
    color,
    spawns: [],
  }
}

function normalizePulls(pulls: PlannerPull[]) {
  return pulls.map((pull, index) => ({
    ...pull,
    label: pull.label || `Pull ${index + 1}`,
    color: getPullColor(index),
  }))
}

function createRouteName(dungeonKey: DungeonKey, routes: PlannerRoute[]) {
  const dungeon = dungeonsByKey[dungeonKey]
  const base = `${dungeon.shortName} Route`
  const matching = routes.filter(
    (route) => route.dungeonKey === dungeonKey && route.name.startsWith(base),
  )
  return matching.length === 0 ? base : `${base} ${matching.length + 1}`
}

function createRoute(
  dungeonKey: DungeonKey,
  routes: PlannerRoute[],
): PlannerRoute {
  const now = new Date().toISOString()
  return {
    id: createId("route"),
    schemaVersion: 1,
    name: createRouteName(dungeonKey, routes),
    dungeonKey,
    pulls: [createPull("Pull 1", getPullColor(0))],
    notes: [],
    drawings: [],
    stickers: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createInitialPresent(): PlannerPresent {
  const dungeonKey = dungeons[0]?.key ?? "aa"
  const initialRoute = createRoute(dungeonKey, [])
  return {
    seasonLabel,
    dungeonKey,
    routes: [initialRoute],
    activeRouteId: initialRoute.id,
    selectedPullId: initialRoute.pulls[0]?.id ?? "",
    mode: "pulls",
    drawTool: "line",
    draftDrawing: [],
  }
}

function clonePresent(present: PlannerPresent): PlannerPresent {
  return structuredClone(present)
}

function getActiveRoute(present: PlannerPresent) {
  return (
    present.routes.find((route) => route.id === present.activeRouteId) ??
    present.routes[0]
  )
}

function getSelectedPull(route: PlannerRoute, selectedPullId: string) {
  return (
    route.pulls.find((pull) => pull.id === selectedPullId) ?? route.pulls[0]
  )
}

function touchRoute(route: PlannerRoute) {
  route.updatedAt = new Date().toISOString()
}

function groupedSpawnIds(
  dungeonKey: DungeonKey,
  spawnId: SpawnId,
  individual?: boolean,
) {
  if (individual) {
    return [spawnId]
  }

  const dungeon = dungeonsByKey[dungeonKey]
  const mobSpawn = dungeon.mobSpawns[spawnId]
  const group = mobSpawn?.spawn.group

  if (group == null) {
    return [spawnId]
  }

  return dungeon.mobSpawnsList
    .filter(({ spawn }) => spawn.group === group)
    .map(({ spawn }) => spawn.id)
}

function normalizeRoute(route: PlannerRoute) {
  route.pulls = normalizePulls(route.pulls)
  route.stickers ??= []
}

function sanitizeRoute(route: PlannerRoute) {
  const dungeon = dungeonsByKey[route.dungeonKey]
  if (!dungeon) {
    return route
  }

  const validSpawnIds = new Set(Object.keys(dungeon.mobSpawns))
  const sanitizedPulls = normalizePulls(
    route.pulls.map((pull, index) => {
      const seenSpawnIds = new Set<SpawnId>()
      return {
        ...pull,
        label: pull.label || `Pull ${index + 1}`,
        spawns: pull.spawns.filter((spawnId) => {
          if (!validSpawnIds.has(spawnId) || seenSpawnIds.has(spawnId)) {
            return false
          }

          seenSpawnIds.add(spawnId)
          return true
        }),
      }
    }),
  )

  const changed = sanitizedPulls.some((pull, index) => {
    const original = route.pulls[index]
    return (
      !original ||
      original.spawns.length !== pull.spawns.length ||
      original.spawns.some(
        (spawnId, spawnIndex) => spawnId !== pull.spawns[spawnIndex],
      )
    )
  })

  if (!changed) {
    normalizeRoute(route)
    return route
  }

  return {
    ...route,
    pulls: sanitizedPulls,
    stickers: route.stickers ?? [],
    updatedAt: new Date().toISOString(),
  }
}

export function sanitizePlannerPresent(present: PlannerPresent) {
  const dungeonKey = dungeonsByKey[present.dungeonKey]
    ? present.dungeonKey
    : (dungeons[0]?.key ?? "aa")

  return {
    ...present,
    dungeonKey,
    drawTool: present.drawTool ?? "line",
    routes: present.routes.map(sanitizeRoute),
  }
}

function ensureSelection(present: PlannerPresent) {
  const activeRoute = getActiveRoute(present)
  if (!activeRoute) {
    const fallback = createRoute(present.dungeonKey, present.routes)
    present.routes.push(fallback)
    present.activeRouteId = fallback.id
    present.selectedPullId = fallback.pulls[0].id
    return
  }

  present.activeRouteId = activeRoute.id
  const selectedPull = getSelectedPull(activeRoute, present.selectedPullId)
  present.selectedPullId = selectedPull.id
}

function routesForDungeon(present: PlannerPresent, dungeonKey: DungeonKey) {
  return present.routes.filter((route) => route.dungeonKey === dungeonKey)
}

type PlannerStore = PlannerSnapshot & {
  hydrated: boolean
  hydrate: () => void
  setDungeon: (dungeonKey: DungeonKey) => void
  setMode: (mode: PlannerMode) => void
  setDrawTool: (drawTool: PlannerDrawTool) => void
  selectRoute: (routeId: string) => void
  createRoute: () => void
  duplicateActiveRoute: () => void
  deleteActiveRoute: () => void
  renameActiveRoute: (name: string) => void
  clearActiveRoute: () => void
  selectPull: (pullId: string) => void
  selectPullRelative: (direction: -1 | 1) => void
  addPull: () => void
  appendPull: () => void
  prependPull: () => void
  clearSelectedPull: () => void
  deleteSelectedPull: (options?: { moveUp?: boolean }) => void
  moveSelectedPull: (direction: -1 | 1) => void
  reorderPull: (sourcePullId: string, targetIndex: number) => void
  toggleSpawn: (spawnId: SpawnId, options?: { individual?: boolean }) => void
  addNote: (position: Point, text?: string) => void
  updateNote: (noteId: string, text: string) => void
  deleteNote: (noteId: string) => void
  appendDraftPoint: (point: Point) => void
  commitDraftDrawing: () => void
  deleteDrawing: (drawingId: string) => void
  cancelDraftDrawing: () => void
  addSticker: (
    kind: Exclude<PlannerDrawTool, "line">,
    position: Point,
    text?: string,
  ) => void
  moveSticker: (stickerId: string, position: Point) => void
  deleteSticker: (stickerId: string) => void
  importSharedRoute: (route: PlannerRoute) => void
  setActiveRouteShareId: (shareId: string) => void
  undo: () => void
  redo: () => void
}

function persistPresent(present: PlannerPresent) {
  if (typeof window === "undefined") {
    return
  }

  pendingPersistPresent = present

  if (persistTimer != null) {
    window.clearTimeout(persistTimer)
  }

  persistTimer = window.setTimeout(() => {
    if (pendingPersistPresent) {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(pendingPersistPresent),
      )
      pendingPersistPresent = null
    }
    persistTimer = null
  }, 0)
}

function reorderRoutePulls(
  route: PlannerRoute,
  sourceIndex: number,
  targetIndex: number,
) {
  if (
    sourceIndex < 0 ||
    sourceIndex >= route.pulls.length ||
    targetIndex < 0 ||
    targetIndex >= route.pulls.length ||
    sourceIndex === targetIndex
  ) {
    return false
  }

  const [movedPull] = route.pulls.splice(sourceIndex, 1)
  route.pulls.splice(targetIndex, 0, movedPull)
  route.pulls = normalizePulls(
    route.pulls.map((pull, pullIndex) => ({
      ...pull,
      label: `Pull ${pullIndex + 1}`,
    })),
  )
  touchRoute(route)
  return true
}

export const usePlannerStore = create<PlannerStore>((set) => {
  function commit(
    mutator: (draft: PlannerPresent) => void,
    recordHistory = true,
  ) {
    set((state) => {
      const draft = clonePresent(state.present)
      mutator(draft)
      ensureSelection(draft)
      persistPresent(draft)

      return {
        hydrated: true,
        present: draft,
        past: recordHistory
          ? [...state.past, state.present].slice(-100)
          : state.past,
        future: recordHistory ? [] : state.future,
      }
    })
  }

  return {
    hydrated: false,
    past: [],
    present: createInitialPresent(),
    future: [],
    hydrate: () => {
      if (typeof window === "undefined") {
        set({ hydrated: true })
        return
      }

      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        const present = createInitialPresent()
        persistPresent(present)
        set({ present, hydrated: true })
        return
      }

      try {
        const present = sanitizePlannerPresent(
          JSON.parse(raw) as PlannerPresent,
        )
        present.routes.forEach(normalizeRoute)
        ensureSelection(present)
        set({ present, hydrated: true })
      } catch {
        const present = createInitialPresent()
        persistPresent(present)
        set({ present, hydrated: true })
      }
    },
    setDungeon: (dungeonKey) =>
      commit((draft) => {
        draft.dungeonKey = dungeonKey
        const existing = routesForDungeon(draft, dungeonKey).at(-1)
        if (existing) {
          draft.activeRouteId = existing.id
          draft.selectedPullId = existing.pulls[0]?.id ?? ""
        } else {
          const route = createRoute(dungeonKey, draft.routes)
          draft.routes.push(route)
          draft.activeRouteId = route.id
          draft.selectedPullId = route.pulls[0].id
        }
        draft.mode = "pulls"
        draft.drawTool = "line"
        draft.draftDrawing = []
      }, false),
    setMode: (mode) =>
      commit((draft) => {
        draft.mode = mode
        if (mode !== "draw") {
          draft.draftDrawing = []
        }
      }, false),
    setDrawTool: (drawTool) =>
      commit((draft) => {
        draft.drawTool = drawTool
        if (drawTool !== "line") {
          draft.draftDrawing = []
        }
      }, false),
    selectRoute: (routeId) =>
      commit((draft) => {
        const route = draft.routes.find((item) => item.id === routeId)
        if (!route) {
          return
        }

        draft.activeRouteId = routeId
        draft.dungeonKey = route.dungeonKey
        draft.selectedPullId = route.pulls[0]?.id ?? ""
      }, false),
    createRoute: () =>
      commit((draft) => {
        const route = createRoute(draft.dungeonKey, draft.routes)
        draft.routes.push(route)
        draft.activeRouteId = route.id
        draft.selectedPullId = route.pulls[0].id
      }),
    duplicateActiveRoute: () =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const copy = structuredClone(route)
        copy.id = createId("route")
        copy.name = `${route.name} Copy`
        copy.createdAt = new Date().toISOString()
        copy.updatedAt = copy.createdAt
        delete copy.shareId
        copy.pulls = copy.pulls.map((pull, index) => ({
          ...pull,
          id: createId("pull"),
          label: pull.label || `Pull ${index + 1}`,
        }))
        copy.notes = copy.notes.map((note) => ({
          ...note,
          id: createId("note"),
        }))
        copy.drawings = copy.drawings.map((drawing) => ({
          ...drawing,
          id: createId("drawing"),
        }))
        copy.stickers = copy.stickers.map((sticker) => ({
          ...sticker,
          id: createId("sticker"),
        }))
        draft.routes.push(copy)
        draft.activeRouteId = copy.id
        draft.selectedPullId = copy.pulls[0].id
      }),
    deleteActiveRoute: () =>
      commit((draft) => {
        const activeRoute = getActiveRoute(draft)
        if (!activeRoute) {
          return
        }

        draft.routes = draft.routes.filter(
          (route) => route.id !== activeRoute.id,
        )
        const nextRoute =
          routesForDungeon(draft, draft.dungeonKey).at(-1) ??
          (() => {
            const route = createRoute(draft.dungeonKey, draft.routes)
            draft.routes.push(route)
            return route
          })()

        draft.activeRouteId = nextRoute.id
        draft.selectedPullId = nextRoute.pulls[0].id
      }),
    renameActiveRoute: (name) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        route.name = name.trim() || route.name
        touchRoute(route)
      }),
    clearActiveRoute: () =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        route.pulls = [createPull("Pull 1", getPullColor(0))]
        route.notes = []
        route.drawings = []
        route.stickers = []
        touchRoute(route)
        draft.selectedPullId = route.pulls[0].id
        draft.draftDrawing = []
      }),
    selectPull: (pullId) =>
      commit((draft) => {
        draft.selectedPullId = pullId
      }, false),
    selectPullRelative: (direction) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const currentIndex = route.pulls.findIndex(
          (pull) => pull.id === draft.selectedPullId,
        )
        if (currentIndex < 0) {
          return
        }

        const nextIndex = currentIndex + direction
        const nextPull = route.pulls[nextIndex]
        if (!nextPull) {
          return
        }

        draft.selectedPullId = nextPull.id
      }, false),
    addPull: () =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const pull = createPull(
          `Pull ${route.pulls.length + 1}`,
          getPullColor(route.pulls.length),
        )
        route.pulls.push(pull)
        touchRoute(route)
        draft.selectedPullId = pull.id
      }),
    appendPull: () =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const currentIndex = route.pulls.findIndex(
          (pull) => pull.id === draft.selectedPullId,
        )
        const insertIndex =
          currentIndex >= 0 ? currentIndex + 1 : route.pulls.length
        const pull = createPull(
          `Pull ${insertIndex + 1}`,
          getPullColor(insertIndex),
        )
        route.pulls.splice(insertIndex, 0, pull)
        route.pulls = normalizePulls(
          route.pulls.map((item, index) => ({
            ...item,
            label: `Pull ${index + 1}`,
          })),
        )
        touchRoute(route)
        draft.selectedPullId = pull.id
      }),
    prependPull: () =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const currentIndex = route.pulls.findIndex(
          (pull) => pull.id === draft.selectedPullId,
        )
        const insertIndex = currentIndex >= 0 ? currentIndex : 0
        const pull = createPull(
          `Pull ${insertIndex + 1}`,
          getPullColor(insertIndex),
        )
        route.pulls.splice(insertIndex, 0, pull)
        route.pulls = normalizePulls(
          route.pulls.map((item, index) => ({
            ...item,
            label: `Pull ${index + 1}`,
          })),
        )
        touchRoute(route)
        draft.selectedPullId = pull.id
      }),
    clearSelectedPull: () =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const selectedPull = getSelectedPull(route, draft.selectedPullId)
        selectedPull.spawns = []
        touchRoute(route)
      }),
    deleteSelectedPull: (options) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const deletedIndex = route.pulls.findIndex(
          (pull) => pull.id === draft.selectedPullId,
        )
        route.pulls = route.pulls.filter(
          (pull) => pull.id !== draft.selectedPullId,
        )
        if (route.pulls.length === 0) {
          route.pulls = [createPull("Pull 1", getPullColor(0))]
        }
        route.pulls = normalizePulls(
          route.pulls.map((pull, index) => ({
            ...pull,
            label: `Pull ${index + 1}`,
          })),
        )
        touchRoute(route)
        const nextIndex = options?.moveUp
          ? Math.max(0, deletedIndex - 1)
          : Math.min(route.pulls.length - 1, deletedIndex)
        draft.selectedPullId = route.pulls[nextIndex]?.id ?? route.pulls[0].id
      }),
    moveSelectedPull: (direction) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const index = route.pulls.findIndex(
          (pull) => pull.id === draft.selectedPullId,
        )
        const nextIndex = index + direction
        if (!reorderRoutePulls(route, index, nextIndex)) {
          return
        }
      }),
    reorderPull: (sourcePullId, targetIndex) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const sourceIndex = route.pulls.findIndex(
          (pull) => pull.id === sourcePullId,
        )
        if (!reorderRoutePulls(route, sourceIndex, targetIndex)) {
          return
        }

        draft.selectedPullId =
          route.pulls[targetIndex]?.id ?? draft.selectedPullId
      }),
    toggleSpawn: (spawnId, options) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const targetSpawnIds = groupedSpawnIds(
          draft.dungeonKey,
          spawnId,
          options?.individual,
        )
        const targetSpawnIdSet = new Set(targetSpawnIds)
        const selectedPull = getSelectedPull(route, draft.selectedPullId)
        const selectedPullSpawnSet = new Set(selectedPull.spawns)
        const allSelected = targetSpawnIds.every((targetSpawnId) =>
          selectedPullSpawnSet.has(targetSpawnId),
        )

        route.pulls.forEach((pull) => {
          if (pull.id !== selectedPull.id) {
            pull.spawns = pull.spawns.filter(
              (pullSpawnId) => !targetSpawnIdSet.has(pullSpawnId),
            )
          }
        })

        if (allSelected) {
          selectedPull.spawns = selectedPull.spawns.filter(
            (pullSpawnId) => !targetSpawnIdSet.has(pullSpawnId),
          )
        } else {
          selectedPull.spawns = [
            ...selectedPull.spawns.filter(
              (pullSpawnId) => !targetSpawnIdSet.has(pullSpawnId),
            ),
            ...targetSpawnIds,
          ]
        }

        touchRoute(route)
      }),
    addNote: (position, text) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        route.notes.push({
          id: createId("note"),
          text: text?.trim() || "New note",
          position,
        })
        touchRoute(route)
      }),
    updateNote: (noteId, text) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        const note = route?.notes.find((item) => item.id === noteId)
        if (!note) {
          return
        }

        note.text = text
        touchRoute(route)
      }),
    deleteNote: (noteId) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        route.notes = route.notes.filter((note) => note.id !== noteId)
        touchRoute(route)
      }),
    appendDraftPoint: (point) =>
      commit((draft) => {
        if (draft.drawTool !== "line") {
          return
        }

        draft.draftDrawing = [...draft.draftDrawing, point]
      }, false),
    commitDraftDrawing: () =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route || draft.draftDrawing.length < 2) {
          draft.draftDrawing = []
          return
        }

        route.drawings.push({
          id: createId("drawing"),
          color: "#facc15",
          weight: 4,
          points: [...draft.draftDrawing],
        })
        touchRoute(route)
        draft.draftDrawing = []
      }),
    deleteDrawing: (drawingId) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        route.drawings = route.drawings.filter(
          (drawing) => drawing.id !== drawingId,
        )
        touchRoute(route)
      }),
    cancelDraftDrawing: () =>
      commit((draft) => {
        draft.draftDrawing = []
      }, false),
    addSticker: (kind, position, text) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        route.stickers.push({
          id: createId("sticker"),
          kind,
          position,
          text: text?.trim() || undefined,
        })
        touchRoute(route)
      }),
    moveSticker: (stickerId, position) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        const sticker = route.stickers.find((item) => item.id === stickerId)
        if (!sticker) {
          return
        }

        sticker.position = position
        touchRoute(route)
      }),
    deleteSticker: (stickerId) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        route.stickers = route.stickers.filter(
          (sticker) => sticker.id !== stickerId,
        )
        touchRoute(route)
      }),
    importSharedRoute: (route) =>
      commit((draft) => {
        const importedRoute = sanitizeRoute({
          ...route,
          shareId: undefined,
          id: createId("route"),
          schemaVersion: 1,
          name: `${route.name} Imported`,
          pulls: normalizePulls(
            route.pulls.map((pull, index) => ({
              ...pull,
              id: createId("pull"),
              label: pull.label || `Pull ${index + 1}`,
            })),
          ),
          notes: route.notes.map((note) => ({ ...note, id: createId("note") })),
          drawings: route.drawings.map((drawing) => ({
            ...drawing,
            id: createId("drawing"),
          })),
          stickers: (route.stickers ?? []).map((sticker) => ({
            ...sticker,
            id: createId("sticker"),
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

        draft.routes.push(importedRoute)
        draft.dungeonKey = importedRoute.dungeonKey
        draft.activeRouteId = importedRoute.id
        draft.selectedPullId = importedRoute.pulls[0]?.id ?? ""
      }),
    setActiveRouteShareId: (shareId) =>
      commit((draft) => {
        const route = getActiveRoute(draft)
        if (!route) {
          return
        }

        route.shareId = shareId
      }, false),
    undo: () =>
      set((state) => {
        const previous = state.past.at(-1)
        if (!previous) {
          return state
        }

        persistPresent(previous)
        return {
          past: state.past.slice(0, -1),
          present: previous,
          future: [state.present, ...state.future],
        }
      }),
    redo: () =>
      set((state) => {
        const next = state.future[0]
        if (!next) {
          return state
        }

        persistPresent(next)
        return {
          past: [...state.past, state.present],
          present: next,
          future: state.future.slice(1),
        }
      }),
  }
})

export function selectActiveRoute(present: PlannerPresent) {
  return getActiveRoute(present)
}

export function selectActiveDungeon(present: PlannerPresent) {
  return dungeonsByKey[present.dungeonKey]
}

export function selectActiveRouteId(present: PlannerPresent) {
  return present.activeRouteId
}

export function selectDungeonKey(present: PlannerPresent) {
  return present.dungeonKey
}

export function selectDraftDrawing(present: PlannerPresent) {
  return present.draftDrawing
}

export function selectDrawTool(present: PlannerPresent) {
  return present.drawTool
}

export function selectMode(present: PlannerPresent) {
  return present.mode
}

export function selectSelectedPullId(present: PlannerPresent) {
  return present.selectedPullId
}

export function selectSelectedPull(present: PlannerPresent) {
  const route = getActiveRoute(present)
  return route ? getSelectedPull(route, present.selectedPullId) : undefined
}

export function selectPullCount(present: PlannerPresent, pullId: string) {
  const route = getActiveRoute(present)
  return route?.pulls.find((pull) => pull.id === pullId)
}
