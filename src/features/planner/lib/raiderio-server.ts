import { createServerFn } from "@tanstack/react-start"

import { dungeonsByKey } from "@/features/planner/data/dungeons"
import type { DungeonKey } from "@/features/planner/types"

const RAIDER_IO_API_BASE = "https://raider.io/api/v1"
const RAIDER_IO_REGION = "world"
const RAIDER_IO_SEASON = "season-mn-1"
const TOP_RUN_CACHE_TTL_MS = 5 * 60 * 1000

type RaiderRunResponse = {
  rankings?: Array<{
    rank?: number
    score?: number
    run?: {
      keystone_run_id?: number
      mythic_level?: number
      completed_at?: string
      clear_time_ms?: number
      time_remaining_ms?: number
      dungeon?: {
        name?: string
        slug?: string
      }
      weekly_modifiers?: Array<{
        id?: number
        name?: string
        slug?: string
      }>
      roster?: Array<{
        character?: {
          name?: string
          class?: {
            name?: string
          }
          spec?: {
            name?: string
          }
        }
        role?: string
      }>
    }
  }>
}

export type RaiderTopRun = {
  rank: number
  score: number
  runId: number
  mythicLevel: number
  completedAt: string
  clearTimeMs: number
  timeRemainingMs: number
  dungeonName: string
  dungeonSlug: string
  affixes: string[]
  team: Array<{
    name: string
    className: string | null
    specName: string | null
    role: string | null
  }>
  url: string
}

const topRunCache = new Map<
  string,
  { expiresAt: number; runs: RaiderTopRun[] }
>()

function toRaiderTopRun(
  entry: NonNullable<RaiderRunResponse["rankings"]>[number],
) {
  const run = entry.run
  const dungeonSlug = run?.dungeon?.slug
  const mythicLevel = run?.mythic_level
  const runId = run?.keystone_run_id

  if (
    typeof entry.rank !== "number" ||
    typeof entry.score !== "number" ||
    typeof mythicLevel !== "number" ||
    typeof runId !== "number" ||
    typeof run?.completed_at !== "string" ||
    typeof run?.clear_time_ms !== "number" ||
    typeof run?.time_remaining_ms !== "number" ||
    typeof run?.dungeon?.name !== "string" ||
    typeof dungeonSlug !== "string"
  ) {
    return null
  }

  return {
    rank: entry.rank,
    score: entry.score,
    runId,
    mythicLevel,
    completedAt: run.completed_at,
    clearTimeMs: run.clear_time_ms,
    timeRemainingMs: run.time_remaining_ms,
    dungeonName: run.dungeon.name,
    dungeonSlug,
    affixes: (run.weekly_modifiers ?? [])
      .map((affix) => affix.name)
      .filter(
        (affixName): affixName is string => typeof affixName === "string",
      ),
    team: (run.roster ?? []).map((member) => ({
      name: member.character?.name ?? "Unknown",
      className: member.character?.class?.name ?? null,
      specName: member.character?.spec?.name ?? null,
      role: member.role ?? null,
    })),
    url: `https://raider.io/mythic-plus-runs/${RAIDER_IO_SEASON}/${runId}-${mythicLevel}-${dungeonSlug}`,
  } satisfies RaiderTopRun
}

async function fetchRaiderTopRuns(dungeonKey: DungeonKey) {
  const cacheKey = `${RAIDER_IO_SEASON}:${dungeonKey}`
  const cached = topRunCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.runs
  }

  const dungeon = dungeonsByKey[dungeonKey]
  if (!dungeon) {
    throw new Error(`Unknown dungeon key: ${dungeonKey}`)
  }

  const params = new URLSearchParams({
    season: RAIDER_IO_SEASON,
    region: RAIDER_IO_REGION,
    dungeon: dungeon.name,
  })

  const response = await fetch(
    `${RAIDER_IO_API_BASE}/mythic-plus/runs?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Raider.IO top runs request failed with ${response.status}`)
  }

  const payload = (await response.json()) as RaiderRunResponse
  const runs = (payload.rankings ?? [])
    .map(toRaiderTopRun)
    .filter((run): run is RaiderTopRun => run !== null)
    .slice(0, 5)

  topRunCache.set(cacheKey, {
    expiresAt: Date.now() + TOP_RUN_CACHE_TTL_MS,
    runs,
  })

  return runs
}

export const getRaiderTopRuns = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { dungeonKey: DungeonKey })
  .handler(async ({ data }) => fetchRaiderTopRuns(data.dungeonKey))
