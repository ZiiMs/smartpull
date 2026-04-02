import type { DungeonKey } from "../src/features/planner/types.ts"
import { generateRaiderTopRoutes } from "./raiderio-top-routes.ts"

const dungeonKey = process.argv[2]

if (!dungeonKey) {
  console.error(
    "Usage: node --experimental-strip-types server/test-raiderio-top-routes.ts <dungeon-key>",
  )
  process.exit(1)
}

const routes = await generateRaiderTopRoutes(dungeonKey as DungeonKey)

console.log(
  JSON.stringify(
    routes.map((route) => ({
      rank: route.rank,
      mythicLevel: route.mythicLevel,
      runId: route.runId,
      keystoneGuruUrl: route.keystoneGuruUrl,
      mdtLength: route.mdt.length,
    })),
    null,
    2,
  ),
)

for (const route of routes) {
  console.log(`MDT rank ${route.rank}:`)
  console.log(route.mdt)
}
