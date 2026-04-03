import { describe, expect, it } from "vitest"

import {
  encodeSharedRoute,
  decodeSharedRoute,
} from "@/features/planner/lib/share-codec"
import type { PlannerRoute } from "@/features/planner/types"

const sampleRoute: PlannerRoute = {
  id: "route_1",
  schemaVersion: 1,
  name: "AA Route",
  dungeonKey: "aa",
  pulls: [
    { id: "pull_1", label: "Pull 1", color: "#ff6b6b", spawns: ["1-1", "1-2"] },
  ],
  notes: [{ id: "note_1", text: "Hero here", position: [-20, 40] }],
  drawings: [
    {
      id: "drawing_1",
      color: "#facc15",
      weight: 4,
      points: [
        [-20, 40],
        [-30, 70],
      ],
    },
  ],
  stickers: [{ id: "sticker_1", kind: "bloodlust", position: [-10, 25] }],
  createdAt: "2026-03-30T00:00:00.000Z",
  updatedAt: "2026-03-30T00:00:00.000Z",
}

describe("share-codec", () => {
  it("round-trips planner routes", () => {
    const payload = encodeSharedRoute(sampleRoute)
    expect(decodeSharedRoute(payload)).toEqual(sampleRoute)
  })
})
