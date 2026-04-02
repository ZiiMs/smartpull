import { createRequire } from "node:module"

import parser from "node-weakauras-parser"

import { createId } from "../src/features/planner/lib/ids.ts"
import { getPullColor } from "../src/features/planner/lib/pull-colors.ts"
import type {
  MdtRoute,
  PlannerPull,
  PlannerRoute,
  SpawnId,
} from "../src/features/planner/types.ts"

const require = createRequire(import.meta.url)

const kgBaseUrl = "https://keystone.guru"
const kgRouteContextMarker =
  "_stateManager.setMapContext($.extend({}, mapContextStaticData, mapContextDungeonData, mapContextMappingVersionData, "
const kgMappingDataMarker = "let mapContextMappingVersionData = "
const kgShortLinkPattern = /^[A-Za-z0-9]+$/

type LocalMdtDungeon = {
  dungeonIndex: number
  enemies: Array<{
    id: number
    enemyIndex: number
    name: string
    count: number
    spawns: Array<{
      idx: number
    }>
  }>
}

type LocalDungeonConfig = {
  key: PlannerRoute["dungeonKey"]
  name: string
  shortName: string
  mdt: LocalMdtDungeon
}

type KeystoneGuruEnemy = {
  id: number
  npc_id: number
  mdt_id: number | null
}

type KeystoneGuruKillZone = {
  index: number
  enemies: number[]
}

type KeystoneGuruRouteContext = {
  publicKey: string
  killZones: KeystoneGuruKillZone[]
  mappingVersionUpgradeUrl: string
}

type KeystoneGuruMappingData = {
  dungeon: {
    slug: string
    mdt_id: number
    enemies: KeystoneGuruEnemy[]
  }
}

const localDungeons: LocalDungeonConfig[] = [
  {
    key: "aa",
    name: "Algeth'ar Academy",
    shortName: "AA",
    mdt: require("../src/features/planner/data/mdt/aa.json") as LocalMdtDungeon,
  },
  {
    key: "cavns",
    name: "Maisara Caverns",
    shortName: "CAVNS",
    mdt: require("../src/features/planner/data/mdt/cavns.json") as LocalMdtDungeon,
  },
  {
    key: "magi",
    name: "Magisters' Terrace",
    shortName: "MAGI",
    mdt: require("../src/features/planner/data/mdt/magi.json") as LocalMdtDungeon,
  },
  {
    key: "pit",
    name: "Pit of Saron",
    shortName: "PIT",
    mdt: require("../src/features/planner/data/mdt/pit.json") as LocalMdtDungeon,
  },
  {
    key: "seat",
    name: "Seat of the Triumvirate",
    shortName: "SEAT",
    mdt: require("../src/features/planner/data/mdt/seat.json") as LocalMdtDungeon,
  },
  {
    key: "sky",
    name: "Skyreach",
    shortName: "SKY",
    mdt: require("../src/features/planner/data/mdt/sky.json") as LocalMdtDungeon,
  },
  {
    key: "wind",
    name: "Windrunner Spire",
    shortName: "WIND",
    mdt: require("../src/features/planner/data/mdt/wind.json") as LocalMdtDungeon,
  },
  {
    key: "xenas",
    name: "Nexus-Point Xenas",
    shortName: "XENAS",
    mdt: require("../src/features/planner/data/mdt/xenas.json") as LocalMdtDungeon,
  },
]

const localDungeonByMdtIndex = new Map(
  localDungeons.map((dungeon) => [dungeon.mdt.dungeonIndex, dungeon]),
)

function extractBalancedObject(text: string, startIndex: number) {
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (character === "\\") {
        escaped = true
        continue
      }

      if (character === '"') {
        inString = false
      }

      continue
    }

    if (character === '"') {
      inString = true
      continue
    }

    if (character === "{") {
      depth += 1
    } else if (character === "}") {
      depth -= 1

      if (depth === 0) {
        return text.slice(startIndex, index + 1)
      }
    }
  }

  throw new Error("Could not extract balanced JSON object")
}

function resolveKeystoneGuruUrl(input: string) {
  if (/^https?:\/\//i.test(input)) {
    return input
  }

  if (kgShortLinkPattern.test(input)) {
    return `${kgBaseUrl}/${input}`
  }

  throw new Error("Expected a Keystone.Guru URL or short public key")
}

function parseRouteContext(html: string) {
  const markerIndex = html.indexOf(kgRouteContextMarker)
  if (markerIndex < 0) {
    throw new Error("Could not find Keystone.Guru route context in page HTML")
  }

  const objectStart = html.indexOf(
    "{",
    markerIndex + kgRouteContextMarker.length,
  )
  if (objectStart < 0) {
    throw new Error("Could not find Keystone.Guru route context JSON start")
  }

  return JSON.parse(
    extractBalancedObject(html, objectStart),
  ) as KeystoneGuruRouteContext
}

function parseMappingData(script: string) {
  const markerIndex = script.indexOf(kgMappingDataMarker)
  if (markerIndex < 0) {
    throw new Error("Could not find Keystone.Guru mapping data in script")
  }

  const objectStart = script.indexOf(
    "{",
    markerIndex + kgMappingDataMarker.length,
  )
  if (objectStart < 0) {
    throw new Error("Could not find Keystone.Guru mapping data JSON start")
  }

  return JSON.parse(
    extractBalancedObject(script, objectStart),
  ) as KeystoneGuruMappingData
}

function findMappingScriptUrl(html: string) {
  const match = html.match(
    /src="(https:\/\/assets\.keystone\.guru\/compiled\/[^"]+\/mapcontext\/data\/[^"]+\/\d+\/[^"]+\.js)"/,
  )

  if (!match?.[1]) {
    throw new Error("Could not find Keystone.Guru mapping script URL")
  }

  return match[1]
}

function buildSpawnLookup(dungeon: LocalDungeonConfig) {
  const lookup = new Map<string, SpawnId>()

  for (const enemy of dungeon.mdt.enemies) {
    for (const spawn of enemy.spawns) {
      lookup.set(`${enemy.id}:${spawn.idx}`, `${enemy.enemyIndex}-${spawn.idx}`)
    }
  }

  return lookup
}

function createPlannerPulls(
  dungeon: LocalDungeonConfig,
  routeContext: KeystoneGuruRouteContext,
  mappingData: KeystoneGuruMappingData,
) {
  const kgEnemyById = new Map<number, KeystoneGuruEnemy>(
    mappingData.dungeon.enemies.map((enemy) => [enemy.id, enemy]),
  )
  const spawnLookup = buildSpawnLookup(dungeon)

  return routeContext.killZones
    .slice()
    .sort((left, right) => left.index - right.index)
    .map<PlannerPull>((killZone, index) => {
      const spawns = killZone.enemies.flatMap((kgEnemyId) => {
        const kgEnemy = kgEnemyById.get(kgEnemyId)
        if (!kgEnemy || typeof kgEnemy.mdt_id !== "number") {
          return []
        }

        const spawnId = spawnLookup.get(`${kgEnemy.npc_id}:${kgEnemy.mdt_id}`)
        if (!spawnId) {
          throw new Error(
            `Could not map Keystone.Guru enemy ${kgEnemy.id} (${kgEnemy.npc_id}:${kgEnemy.mdt_id}) to local MDT spawn`,
          )
        }

        return [spawnId]
      })

      return {
        id: createId("pull"),
        label: `Pull ${index + 1}`,
        color: getPullColor(index),
        spawns,
      }
    })
}

function plannerRouteToMdtRoute(
  route: PlannerRoute,
  dungeon: LocalDungeonConfig,
): MdtRoute {
  const pullObjects = route.pulls.map((pull) => {
    const enemies = pull.spawns.reduce<Record<number, number[]>>(
      (acc, spawnId) => {
        const [enemyIndexString, spawnIndexString] = spawnId.split("-")
        const enemyIndex = Number(enemyIndexString)
        const spawnIndex = Number(spawnIndexString)

        if (!Number.isFinite(enemyIndex) || !Number.isFinite(spawnIndex)) {
          return acc
        }

        acc[enemyIndex] ??= []
        acc[enemyIndex].push(spawnIndex)
        return acc
      },
      {},
    )

    return {
      color: pull.color.replace("#", ""),
      ...enemies,
    }
  })

  return {
    text: route.name,
    week: 1,
    difficulty: 10,
    uid: route.id,
    value: {
      currentPull: 0,
      currentSublevel: 1,
      currentDungeonIdx: dungeon.mdt.dungeonIndex,
      selection: [],
      pulls: pullObjects,
    },
    objects: [],
  }
}

export async function importKeystoneGuruRoute(
  input: string,
): Promise<PlannerRoute> {
  const response = await fetch(resolveKeystoneGuruUrl(input), {
    headers: {
      Accept: "text/html",
    },
    redirect: "follow",
  })

  if (!response.ok) {
    throw new Error(
      `Failed to load Keystone.Guru route page (${response.status})`,
    )
  }

  const html = await response.text()
  const routeContext = parseRouteContext(html)
  const mappingScriptUrl = findMappingScriptUrl(html)
  const mappingResponse = await fetch(mappingScriptUrl, {
    headers: {
      Accept: "application/javascript,text/javascript,*/*;q=0.1",
    },
  })

  if (!mappingResponse.ok) {
    throw new Error(
      `Failed to load Keystone.Guru mapping data (${mappingResponse.status})`,
    )
  }

  const mappingData = parseMappingData(await mappingResponse.text())
  const dungeon = localDungeonByMdtIndex.get(mappingData.dungeon.mdt_id)
  if (!dungeon) {
    throw new Error(`Unsupported dungeon MDT id: ${mappingData.dungeon.mdt_id}`)
  }

  const now = new Date().toISOString()

  return {
    id: createId("route"),
    schemaVersion: 1,
    name: `${dungeon.name} KG ${routeContext.publicKey}`,
    dungeonKey: dungeon.key,
    pulls: createPlannerPulls(dungeon, routeContext, mappingData),
    notes: [],
    drawings: [],
    createdAt: now,
    updatedAt: now,
  }
}

export async function exportKeystoneGuruRouteToMdt(input: string) {
  const route = await importKeystoneGuruRoute(input)
  const dungeon = localDungeons.find(
    (candidate) => candidate.key === route.dungeonKey,
  )
  if (!dungeon) {
    throw new Error(`Unsupported dungeon key: ${route.dungeonKey}`)
  }

  return parser.encode(plannerRouteToMdtRoute(route, dungeon), 1)
}
