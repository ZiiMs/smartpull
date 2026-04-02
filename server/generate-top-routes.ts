import { writeFile } from "node:fs/promises"

import type { DungeonKey } from "../src/features/planner/types.ts"
import { generateRaiderTopRoutes } from "./raiderio-top-routes.ts"

const dungeonKeys: DungeonKey[] = [
  "aa",
  "cavns",
  "magi",
  "pit",
  "seat",
  "sky",
  "wind",
  "xenas",
]

const outputPath = new URL(
  "../src/features/planner/data/top-routes.json",
  import.meta.url,
)

const routesByDungeon = Object.fromEntries(
  await Promise.all(
    dungeonKeys.map(async (dungeonKey) => [
      dungeonKey,
      await generateRaiderTopRoutes(dungeonKey),
    ]),
  ),
) as Record<DungeonKey, Awaited<ReturnType<typeof generateRaiderTopRoutes>>>

const payload = {
  generatedAt: new Date().toISOString(),
  routesByDungeon,
}

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")

console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(routesByDungeon).map(([dungeonKey, routes]) => [
        dungeonKey,
        routes.length,
      ]),
    ),
    null,
    2,
  ),
)
