import { describe, expect, it } from "vitest"

import { dungeonsByKey } from "@/features/planner/data/dungeons"
import { mobScale } from "@/features/planner/lib/mob-spawns"
import {
  buildPlannerMobFeatureCollection,
  createPlannerMobSpriteId,
  darkenPlannerMobColor,
  parsePlannerMobSpriteId,
  plannerMobPortraitFallbackSrc,
  resolvePlannerMobPortraitSrc,
} from "@/features/planner/lib/mob-rendering"

describe("mob-rendering", () => {
  it("serializes selected mob features with pull colors and labels", () => {
    const dungeon = dungeonsByKey.aa
    const groupedMobSpawn = dungeon.mobSpawnsList.find(
      ({ spawn }) => spawn.group != null,
    )

    if (!groupedMobSpawn?.spawn.group) {
      throw new Error("Expected test dungeon to include a grouped mob spawn")
    }

    const features = buildPlannerMobFeatureCollection({
      dungeonKey: dungeon.key,
      mobSpawns: [groupedMobSpawn],
      pullColorBySpawn: new globalThis.Map([
        [groupedMobSpawn.spawn.id, "#f59e0b"],
      ]),
      selectedSpawnIds: new Set([groupedMobSpawn.spawn.id]),
    })

    const feature = features.features[0]
    expect(feature?.id).toBe(groupedMobSpawn.spawn.id)
    expect(feature?.properties).toMatchObject({
      forceLabel: Number.isInteger(groupedMobSpawn.mob.count)
        ? `${groupedMobSpawn.mob.count}`
        : groupedMobSpawn.mob.count.toFixed(1),
      group: groupedMobSpawn.spawn.group,
      groupLabel: `G${groupedMobSpawn.spawn.group}`,
      isBoss: groupedMobSpawn.mob.isBoss,
      markerScale: mobScale(groupedMobSpawn),
      mobId: groupedMobSpawn.mob.id,
      pullColor: "#f59e0b",
      selectedRingColor: darkenPlannerMobColor("#f59e0b"),
      selected: true,
      spawnId: groupedMobSpawn.spawn.id,
      spriteId: createPlannerMobSpriteId(dungeon.key, groupedMobSpawn.mob.id),
    })
    expect(feature?.properties.forceLabelScale).toBeGreaterThan(0)
    expect(feature?.properties.groupLabelScale).toBeGreaterThan(0)
  })

  it("serializes ungrouped and unassigned mob features without synthetic labels", () => {
    const dungeon = dungeonsByKey.aa
    const ungroupedMobSpawn = dungeon.mobSpawnsList.find(
      ({ spawn }) => spawn.group == null,
    )

    if (!ungroupedMobSpawn) {
      throw new Error("Expected test dungeon to include an ungrouped mob spawn")
    }

    const features = buildPlannerMobFeatureCollection({
      dungeonKey: dungeon.key,
      mobSpawns: [ungroupedMobSpawn],
      pullColorBySpawn: new globalThis.Map(),
      selectedSpawnIds: new Set(),
    })

    const feature = features.features[0]
    expect(feature?.properties.group).toBeNull()
    expect(feature?.properties.groupLabel).toBe("")
    expect(feature?.properties.pullColor).toBeNull()
    expect(feature?.properties.selectedRingColor).toBeNull()
    expect(feature?.properties.selected).toBe(false)
  })

  it("creates stable sprite ids and portrait fallbacks", () => {
    expect(createPlannerMobSpriteId("aa", 12345)).toBe(
      "planner-mob-sprite:aa:12345",
    )
    expect(parsePlannerMobSpriteId("planner-mob-sprite:aa:12345")).toEqual({
      dungeonKey: "aa",
      mobId: 12345,
    })
    expect(parsePlannerMobSpriteId("planner-mob-sprite:aa:not-a-number")).toBe(
      null,
    )
    expect(resolvePlannerMobPortraitSrc(321, new Set())).toBe(
      "/npc_portraits/321.png",
    )
    expect(resolvePlannerMobPortraitSrc(321, new Set([321]))).toBe(
      plannerMobPortraitFallbackSrc,
    )
  })
})
