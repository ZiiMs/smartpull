import { describe, expect, it } from "vitest"
import parser from "node-weakauras-parser"

import {
  mdtRouteToPlannerRoute,
  plannerRouteToMdtRoute,
} from "@/features/planner/lib/mdt-codec"
import type { PlannerRoute } from "@/features/planner/types"

const sampleRoute: PlannerRoute = {
  id: "route_1",
  schemaVersion: 1,
  name: "Skyreach Test",
  dungeonKey: "sky",
  pulls: [
    {
      id: "pull_1",
      label: "Pull 1",
      color: "#ff6b6b",
      spawns: ["1-1", "1-2", "3-1"],
    },
    { id: "pull_2", label: "Pull 2", color: "#f59e0b", spawns: ["4-1"] },
  ],
  notes: [{ id: "note_1", text: "Lust here", position: [-40, 120] }],
  drawings: [
    {
      id: "drawing_1",
      color: "#facc15",
      weight: 4,
      points: [
        [-40, 120],
        [-55, 150],
      ],
    },
  ],
  stickers: [{ id: "sticker_1", kind: "stealth", position: [-52, 140] }],
  createdAt: "2026-03-30T00:00:00.000Z",
  updatedAt: "2026-03-30T00:00:00.000Z",
}

describe("mdt-codec", () => {
  it("round-trips supported planner route data through the MDT string codec", async () => {
    const encoded = await parser.encode(plannerRouteToMdtRoute(sampleRoute), 1)
    const decoded = mdtRouteToPlannerRoute(
      (await parser.decode(encoded)) as ReturnType<
        typeof plannerRouteToMdtRoute
      >,
    )

    expect(decoded.dungeonKey).toBe(sampleRoute.dungeonKey)
    expect(decoded.pulls.map((pull) => pull.spawns)).toEqual(
      sampleRoute.pulls.map((pull) => pull.spawns),
    )
    expect(decoded.pulls.map((pull) => pull.color)).toEqual(
      sampleRoute.pulls.map((pull) => pull.color),
    )
    expect(decoded.notes[0]?.text).toBe("Lust here")
    expect(decoded.drawings).toHaveLength(1)
    expect(decoded.stickers).toEqual([])
  })
})
