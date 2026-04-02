import { describe, expect, it } from "vitest"

import { createDungeonMapCacheKey, plannerMapAssetVersion } from "@/features/planner/lib/map"

describe("map cache versioning", () => {
  it("includes the planner map asset version in cache keys", () => {
    expect(createDungeonMapCacheKey("aa")).toBe(`${plannerMapAssetVersion}:aa`)
  })
})
