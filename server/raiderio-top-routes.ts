import { readFileSync } from "node:fs"
import type { DungeonKey } from "../src/features/planner/types.ts"
import { exportKeystoneGuruRouteToMdt } from "./keystone-guru.ts"

const RAIDER_IO_API_BASE = "https://raider.io/api/v1"
const RAIDER_IO_REGION = "world"
const RAIDER_IO_SEASON = "season-mn-1"
const MAX_CANDIDATE_RUNS = 25
const RAIDER_IO_ACCESS_TOKEN_QUERY_PARAM = "access_token"

type RaiderRunsResponse = {
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
        name?: string
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

type RaiderRunDetailsResponse = {
  logged_details?: {
    route_key?: string
  } | null
}

type RaiderTopRouteCandidate = {
  rank: number
  score: number
  runId: number
  mythicLevel: number
  dungeonName: string
  dungeonSlug: string
  url: string
  team: Array<{
    name: string
    className: string | null
    specName: string | null
    role: string | null
  }>
}

export type RaiderGeneratedTopRoute = {
  rank: number
  score: number
  runId: number
  mythicLevel: number
  dungeonName: string
  dungeonSlug: string
  url: string
  keystoneGuruUrl: string
  team: Array<{
    name: string
    className: string | null
    specName: string | null
    role: string | null
  }>
  mdt: string
}

const dungeonNamesByKey: Record<DungeonKey, string> = {
  aa: "Algeth'ar Academy",
  cavns: "Maisara Caverns",
  magi: "Magisters' Terrace",
  pit: "Pit of Saron",
  seat: "Seat of the Triumvirate",
  sky: "Skyreach",
  wind: "Windrunner Spire",
  xenas: "Nexus-Point Xenas",
}

function toRunUrl(runId: number, mythicLevel: number, dungeonSlug: string) {
  return `https://raider.io/mythic-plus-runs/${RAIDER_IO_SEASON}/${runId}-${mythicLevel}-${dungeonSlug}`
}

function readDotEnvValue(key: string) {
  try {
    const envFile = readFileSync(".env", "utf8")

    for (const line of envFile.split(/\r?\n/)) {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue
      }

      const separatorIndex = trimmedLine.indexOf("=")
      if (separatorIndex < 0) {
        continue
      }

      const envKey = trimmedLine.slice(0, separatorIndex).trim()
      if (envKey !== key) {
        continue
      }

      return trimmedLine.slice(separatorIndex + 1).trim()
    }
  } catch {
    return undefined
  }

  return undefined
}

function getRaiderIoAccessToken() {
  const token =
    process.env.RAIDERIO_API_KEY ??
    process.env.RAIDERIO_ACCESS_TOKEN ??
    readDotEnvValue("RAIDERIO_API_KEY") ??
    readDotEnvValue("RAIDERIO_ACCESS_TOKEN") ??
    null

  if (
    !token ||
    token === "your_raiderio_api_key_here" ||
    token === "your_raiderio_access_token_here"
  ) {
    return null
  }

  return token
}

function withRaiderIoAccessToken(params: URLSearchParams) {
  const accessToken = getRaiderIoAccessToken()
  if (accessToken) {
    params.set(RAIDER_IO_ACCESS_TOKEN_QUERY_PARAM, accessToken)
  }

  return params
}

function toCandidate(
  entry: NonNullable<RaiderRunsResponse["rankings"]>[number],
) {
  const run = entry.run
  const runId = run?.keystone_run_id
  const mythicLevel = run?.mythic_level
  const dungeonName = run?.dungeon?.name
  const dungeonSlug = run?.dungeon?.slug

  if (
    typeof entry.rank !== "number" ||
    typeof entry.score !== "number" ||
    typeof runId !== "number" ||
    typeof mythicLevel !== "number" ||
    typeof dungeonName !== "string" ||
    typeof dungeonSlug !== "string"
  ) {
    return null
  }

  return {
    rank: entry.rank,
    score: entry.score,
    runId,
    mythicLevel,
    dungeonName,
    dungeonSlug,
    url: toRunUrl(runId, mythicLevel, dungeonSlug),
    team: (run?.roster ?? []).map((member) => ({
      name: member.character?.name ?? "Unknown",
      className: member.character?.class?.name ?? null,
      specName: member.character?.spec?.name ?? null,
      role: member.role ?? null,
    })),
  } satisfies RaiderTopRouteCandidate
}

async function fetchCandidateRuns(dungeonKey: DungeonKey) {
  const dungeonName = dungeonNamesByKey[dungeonKey]
  if (!dungeonName) {
    throw new Error(`Unknown dungeon key: ${dungeonKey}`)
  }

  const params = withRaiderIoAccessToken(
    new URLSearchParams({
      season: RAIDER_IO_SEASON,
      region: RAIDER_IO_REGION,
      dungeon: dungeonName,
    }),
  )

  const response = await fetch(
    `${RAIDER_IO_API_BASE}/mythic-plus/runs?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Raider.IO runs request failed with ${response.status}`)
  }

  const payload = (await response.json()) as RaiderRunsResponse
  return (payload.rankings ?? [])
    .map(toCandidate)
    .filter(
      (candidate): candidate is RaiderTopRouteCandidate => candidate !== null,
    )
    .slice(0, MAX_CANDIDATE_RUNS)
}

async function resolveKeystoneGuruRouteKey(candidate: RaiderTopRouteCandidate) {
  const params = withRaiderIoAccessToken(
    new URLSearchParams({
      season: RAIDER_IO_SEASON,
      id: String(candidate.runId),
    }),
  )

  const response = await fetch(
    `${RAIDER_IO_API_BASE}/mythic-plus/run-details?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  )

  if (!response.ok) {
    throw new Error(
      `Raider.IO run-details request failed with ${response.status}`,
    )
  }

  const payload = (await response.json()) as RaiderRunDetailsResponse
  return payload.logged_details?.route_key ?? null
}

async function resolveKeystoneGuruRouteUrl(candidate: RaiderTopRouteCandidate) {
  const routeKey = await resolveKeystoneGuruRouteKey(candidate)
  if (!routeKey) {
    return null
  }

  return `https://keystone.guru/${routeKey}`
}

export async function generateRaiderTopRoutes(
  dungeonKey: DungeonKey,
  targetCount = 5,
) {
  const candidates = await fetchCandidateRuns(dungeonKey)
  const routes: RaiderGeneratedTopRoute[] = []

  for (const candidate of candidates) {
    if (routes.length >= targetCount) {
      break
    }

    let keystoneGuruUrl: string | null
    try {
      keystoneGuruUrl = await resolveKeystoneGuruRouteUrl(candidate)
    } catch {
      continue
    }

    if (!keystoneGuruUrl) {
      continue
    }

    try {
      const mdt = await exportKeystoneGuruRouteToMdt(keystoneGuruUrl)
      routes.push({
        rank: candidate.rank,
        score: candidate.score,
        runId: candidate.runId,
        mythicLevel: candidate.mythicLevel,
        dungeonName: candidate.dungeonName,
        dungeonSlug: candidate.dungeonSlug,
        url: candidate.url,
        keystoneGuruUrl,
        team: candidate.team,
        mdt,
      })
    } catch {
      // Skip candidates whose linked route cannot be converted to local MDT.
    }
  }

  return routes
}
