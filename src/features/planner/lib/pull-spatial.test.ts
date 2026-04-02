import { describe, expect, it } from "vitest"

import { getPullSpatialDiagnostic } from "@/features/planner/lib/pull-spatial"

describe("pull-spatial", () => {
  it("flags spatially incoherent pulls split across distant components", () => {
    const diagnostic = getPullSpatialDiagnostic("aa", ["1-1", "2-1", "1-8", "2-6"])

    expect(diagnostic.componentCount).toBeGreaterThan(1)
    expect(diagnostic.isSpatiallyIncoherent).toBe(true)
  })

  it("does not flag normal tight groups", () => {
    const diagnostic = getPullSpatialDiagnostic("aa", ["1-1", "2-1", "2-7"])

    expect(diagnostic.componentCount).toBe(1)
    expect(diagnostic.isSpatiallyIncoherent).toBe(false)
  })
})
