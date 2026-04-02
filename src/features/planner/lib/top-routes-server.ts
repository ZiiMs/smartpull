import { createServerFn } from "@tanstack/react-start"

import { plannerTopRoutes } from "@/features/planner/data/top-routes"
import type { DungeonKey } from "@/features/planner/types"
import type { RaiderGeneratedTopRoute } from "../../../../server/raiderio-top-routes"

export type ImportableTopRoute = RaiderGeneratedTopRoute

export const getImportableTopRoutes = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { dungeonKey: DungeonKey })
  .handler(async ({ data }) => plannerTopRoutes[data.dungeonKey] ?? [])
