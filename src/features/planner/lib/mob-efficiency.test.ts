import { describe, expect, it } from "vitest"

import {
  calculateMobEfficiencyScore,
  formatMobEfficiencyScore,
  getMobEfficiencyColor,
  getMobEfficiencyDisplay,
} from "@/features/planner/lib/mob-efficiency"

describe("mob-efficiency", () => {
  it("matches the MDT score formula for a known mob", () => {
    const score = calculateMobEfficiencyScore(
      {
        count: 5,
        health: 1518845,
      },
      460,
    )

    expect(score).toBeCloseTo(4.651704019372844, 10)
    expect(formatMobEfficiencyScore(score)).toBe("4.7")
  })

  it("uses the MDT red-to-green gradient for low, mid, and high values", () => {
    expect(getMobEfficiencyColor(0)).toBe("#ff0000")
    expect(getMobEfficiencyColor(5)).toBe("#ffff00")
    expect(getMobEfficiencyColor(10)).toBe("#00ff00")
    expect(getMobEfficiencyColor(4.6470667)).toBe("#ffed00")
  })

  it("handles zero-count mobs without errors", () => {
    expect(
      getMobEfficiencyDisplay(
        {
          count: 0,
          health: 9492781,
        },
        460,
      ),
    ).toEqual({
      score: 0,
      label: "0.0",
      color: "#ff0000",
    })
  })
})
