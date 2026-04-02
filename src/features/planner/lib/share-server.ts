import { createServerFn } from "@tanstack/react-start"

import type { PlannerRoute } from "@/features/planner/types"

export const createSharedRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { route: PlannerRoute; shareId?: string })
  .handler(async ({ data }) => {
    const { createSharedRouteRecord } = await import("../../../../server/share-links")
    return createSharedRouteRecord(data.route, data.shareId)
  })

export const getSharedRoute = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { shareId: string })
  .handler(async ({ data }) => {
    const { getSharedRouteRecord } = await import("../../../../server/share-links")
    const route = await getSharedRouteRecord(data.shareId)

    if (!route) {
      throw new Error("Shared route not found")
    }

    return route
  })
