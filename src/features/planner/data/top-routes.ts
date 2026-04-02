import topRoutesData from "@/features/planner/data/top-routes.json"
import type { ImportableTopRoute } from "@/features/planner/lib/top-routes-server"
import type { DungeonKey } from "@/features/planner/types"

type TopRoutesData = {
  generatedAt: string | null
  routesByDungeon: Record<DungeonKey, ImportableTopRoute[]>
}

const typedTopRoutesData = topRoutesData as TopRoutesData

export const generatedTopRoutesAt = typedTopRoutesData.generatedAt
export const plannerTopRoutes = typedTopRoutesData.routesByDungeon
