import { createServerFn } from "@tanstack/react-start"

import {
  mdtRouteToPlannerRoute,
  plannerRouteToMdtRoute,
} from "@/features/planner/lib/mdt-codec"
import type { PlannerRoute } from "@/features/planner/types"

export const exportMdtRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { route: PlannerRoute })
  .handler(async ({ data }) => {
    const parser = (await import("node-weakauras-parser")).default
    return parser.encode(plannerRouteToMdtRoute(data.route), 1)
  })

export const importMdtRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { text: string })
  .handler(async ({ data }) => {
    const parser = (await import("node-weakauras-parser")).default
    const decoded = await parser.decode(data.text.trim())
    return mdtRouteToPlannerRoute(decoded as ReturnType<typeof plannerRouteToMdtRoute>)
  })
