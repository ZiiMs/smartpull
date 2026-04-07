import { describe, expect, it } from "vitest"

import {
  clampPlannerPointToRange,
  getPlannerPointDistance,
  getUnpairedWarlockGate,
  getWarlockGateConnections,
  warlockGateMaxRange,
} from "@/features/planner/lib/gates"
import type { PlannerSticker } from "@/features/planner/types"

function makeGateSticker(
  id: string,
  position: [number, number],
): PlannerSticker {
  return {
    id,
    kind: "warlockGate",
    position,
  }
}

describe("gates", () => {
  it("measures planner-point distance", () => {
    expect(getPlannerPointDistance([0, 0], [24, 32])).toBe(warlockGateMaxRange)
  })

  it("keeps points inside the gate range unchanged", () => {
    expect(clampPlannerPointToRange([0, 0], [12, 16])).toEqual([12, 16])
  })

  it("clamps points to the 40-unit gate range", () => {
    expect(clampPlannerPointToRange([0, 0], [0, 80])).toEqual([0, 40])
  })

  it("marks a gate pair in range at exactly 40 units", () => {
    const connections = getWarlockGateConnections([
      makeGateSticker("gate-1", [0, 0]),
      makeGateSticker("gate-2", [24, 32]),
    ])

    expect(connections).toHaveLength(1)
    expect(connections[0]).toMatchObject({
      originId: "gate-1",
      destinationId: "gate-2",
      distance: warlockGateMaxRange,
      withinRange: true,
    })
  })

  it("marks a gate pair invalid beyond 40 units", () => {
    const connections = getWarlockGateConnections([
      makeGateSticker("gate-1", [0, 0]),
      makeGateSticker("gate-2", [0, 41]),
    ])

    expect(connections[0]).toMatchObject({
      distance: 41,
      withinRange: false,
    })
  })

  it("pairs gates in placement order and leaves an odd gate unpaired", () => {
    const stickers = [
      makeGateSticker("gate-1", [0, 0]),
      makeGateSticker("gate-2", [10, 0]),
      makeGateSticker("gate-3", [20, 0]),
    ]

    const connections = getWarlockGateConnections(stickers)
    const unpaired = getUnpairedWarlockGate(stickers)

    expect(connections).toHaveLength(1)
    expect(connections[0]).toMatchObject({
      originId: "gate-1",
      destinationId: "gate-2",
    })
    expect(unpaired).toMatchObject({
      id: "gate-3",
      position: [20, 0],
    })
  })
})
