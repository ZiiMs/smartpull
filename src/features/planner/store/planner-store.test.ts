import { beforeEach, describe, expect, it } from "vitest"

import { dungeonsByKey } from "@/features/planner/data/dungeons"
import {
  createInitialPresent,
  sanitizePlannerPresent,
  selectActiveRoute,
  usePlannerStore,
} from "@/features/planner/store/planner-store"
import type { PlannerPresent } from "@/features/planner/types"

function resetStore() {
  usePlannerStore.setState((state) => ({
    ...state,
    past: [],
    future: [],
    hydrated: true,
    present: createInitialPresent(),
  }))
}

describe("planner-store", () => {
  beforeEach(() => {
    resetStore()
  })

  it("creates, undoes, and redoes pull changes", () => {
    usePlannerStore.getState().addPull()
    let present: PlannerPresent = usePlannerStore.getState().present
    expect(selectActiveRoute(present)?.pulls).toHaveLength(2)
    expect(selectActiveRoute(present)?.pulls[0]?.color).toBe("#ff6b6b")
    expect(selectActiveRoute(present)?.pulls[1]?.color).toBe("#f59e0b")

    usePlannerStore.getState().undo()
    present = usePlannerStore.getState().present
    expect(selectActiveRoute(present)?.pulls).toHaveLength(1)

    usePlannerStore.getState().redo()
    present = usePlannerStore.getState().present
    expect(selectActiveRoute(present)?.pulls).toHaveLength(2)
  })

  it("keeps a spawn assigned to only one pull at a time", () => {
    usePlannerStore.getState().addPull()
    let present = usePlannerStore.getState().present
    const route = selectActiveRoute(present)
    const firstPullId = route?.pulls[0]?.id
    const secondPullId = route?.pulls[1]?.id
    const spawnId = dungeonsByKey[present.dungeonKey].mobSpawnsList[0]?.spawn.id
    expect(firstPullId).toBeTruthy()
    expect(secondPullId).toBeTruthy()
    expect(spawnId).toBeTruthy()

    if (!firstPullId || !secondPullId || !spawnId) {
      throw new Error(
        "Expected planner test fixture to provide two pulls and one spawn",
      )
    }

    usePlannerStore.getState().selectPull(firstPullId)
    usePlannerStore.getState().toggleSpawn(spawnId)
    usePlannerStore.getState().selectPull(secondPullId)
    usePlannerStore.getState().toggleSpawn(spawnId)

    present = usePlannerStore.getState().present
    const updatedRoute = selectActiveRoute(present)
    if (!updatedRoute) {
      throw new Error("Expected an active route after assigning a spawn")
    }

    expect(updatedRoute.pulls[0]?.spawns).not.toContain(spawnId)
    expect(updatedRoute.pulls[1]?.spawns).toContain(spawnId)
  })

  it("assigns the full MDT group by default", () => {
    const present = usePlannerStore.getState().present
    const dungeon = dungeonsByKey[present.dungeonKey]
    const groupedSpawn = dungeon.mobSpawnsList.find(
      ({ spawn }) => spawn.group != null,
    )

    if (!groupedSpawn?.spawn.group) {
      throw new Error(
        "Expected planner fixture to provide at least one grouped spawn",
      )
    }

    const expectedGroupSpawnIds = dungeon.mobSpawnsList
      .filter(({ spawn }) => spawn.group === groupedSpawn.spawn.group)
      .map(({ spawn }) => spawn.id)
      .sort()

    usePlannerStore.getState().toggleSpawn(groupedSpawn.spawn.id)

    const route = selectActiveRoute(usePlannerStore.getState().present)
    expect(route?.pulls[0]?.spawns.slice().sort()).toEqual(
      expectedGroupSpawnIds,
    )
  })

  it("removes a grouped selection when toggled again", () => {
    const present = usePlannerStore.getState().present
    const dungeon = dungeonsByKey[present.dungeonKey]
    const groupedSpawn = dungeon.mobSpawnsList.find(
      ({ spawn }) => spawn.group != null,
    )

    if (!groupedSpawn?.spawn.group) {
      throw new Error(
        "Expected planner fixture to provide at least one grouped spawn",
      )
    }

    usePlannerStore.getState().toggleSpawn(groupedSpawn.spawn.id)
    usePlannerStore.getState().toggleSpawn(groupedSpawn.spawn.id)

    const route = selectActiveRoute(usePlannerStore.getState().present)
    expect(route?.pulls[0]?.spawns).toEqual([])
  })

  it("ctrl-style individual selection only toggles one spawn", () => {
    const present = usePlannerStore.getState().present
    const dungeon = dungeonsByKey[present.dungeonKey]
    const groupedSpawn = dungeon.mobSpawnsList.find(
      ({ spawn }) => spawn.group != null,
    )

    if (!groupedSpawn?.spawn.group) {
      throw new Error(
        "Expected planner fixture to provide at least one grouped spawn",
      )
    }

    usePlannerStore
      .getState()
      .toggleSpawn(groupedSpawn.spawn.id, { individual: true })

    const route = selectActiveRoute(usePlannerStore.getState().present)
    expect(route?.pulls[0]?.spawns).toEqual([groupedSpawn.spawn.id])
  })

  it("keeps pull colors stable when pulls are reordered", () => {
    usePlannerStore.getState().addPull()
    const route = selectActiveRoute(usePlannerStore.getState().present)
    const firstPullId = route?.pulls[0]?.id
    const secondPullId = route?.pulls[1]?.id

    if (!firstPullId || !secondPullId) {
      throw new Error("Expected two pulls before reordering")
    }

    usePlannerStore.getState().selectPull(secondPullId)
    usePlannerStore.getState().moveSelectedPull(-1)

    const reorderedRoute = selectActiveRoute(usePlannerStore.getState().present)
    if (!reorderedRoute) {
      throw new Error("Expected an active route after reordering pulls")
    }

    expect(reorderedRoute.pulls[0]?.id).toBe(secondPullId)
    expect(reorderedRoute.pulls[0]?.color).toBe("#ff6b6b")
    expect(reorderedRoute.pulls[1]?.id).toBe(firstPullId)
    expect(reorderedRoute.pulls[1]?.color).toBe("#f59e0b")
  })

  it("reorders pulls to an arbitrary target index", () => {
    usePlannerStore.getState().addPull()
    usePlannerStore.getState().addPull()

    const route = selectActiveRoute(usePlannerStore.getState().present)
    const firstPullId = route?.pulls[0]?.id
    const thirdPullId = route?.pulls[2]?.id

    if (!firstPullId || !thirdPullId) {
      throw new Error("Expected three pulls before drag reorder")
    }

    usePlannerStore.getState().reorderPull(firstPullId, 2)

    const reorderedRoute = selectActiveRoute(usePlannerStore.getState().present)
    expect(reorderedRoute?.pulls.map((pull) => pull.id)).toEqual([
      route?.pulls[1]?.id,
      thirdPullId,
      firstPullId,
    ])
    expect(reorderedRoute?.pulls.map((pull) => pull.label)).toEqual([
      "Pull 1",
      "Pull 2",
      "Pull 3",
    ])
    expect(reorderedRoute?.pulls.map((pull) => pull.color)).toEqual([
      "#ff6b6b",
      "#f59e0b",
      "#facc15",
    ])
  })

  it("sanitizes persisted routes by dropping unknown and duplicate spawn ids", () => {
    const present = createInitialPresent()
    const route = present.routes[0]

    if (!route?.pulls[0]) {
      throw new Error("Expected initial route to include one pull")
    }

    route.pulls[0].spawns = ["1-1", "missing-spawn", "1-1"]

    const sanitized = sanitizePlannerPresent(present)
    expect(sanitized.routes[0]?.pulls[0]?.spawns).toEqual(["1-1"])
  })

  it("creates notes with custom text and falls back when blank", () => {
    const position: [number, number] = [12.5, 42.25]

    usePlannerStore.getState().addNote(position, "Kick this cast")
    usePlannerStore.getState().addNote(position, "   ")

    const route = selectActiveRoute(usePlannerStore.getState().present)
    expect(route?.notes[0]).toMatchObject({
      position,
      text: "Kick this cast",
    })
    expect(route?.notes[1]).toMatchObject({
      position,
      text: "New note",
    })
  })
})
