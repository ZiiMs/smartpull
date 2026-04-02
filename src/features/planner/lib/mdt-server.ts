import { createServerFn } from "@tanstack/react-start"

import {
  mdtRouteToPlannerRoute,
  plannerRouteToMdtRoute,
} from "@/features/planner/lib/mdt-codec"
import type { PlannerRoute } from "@/features/planner/types"

export const exportMdtRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { route: PlannerRoute })
  .handler(async ({ data }) => {
    const { default: parser } = await import("node-weakauras-parser")
    return parser.encode(plannerRouteToMdtRoute(data.route), 1)
  })

export const importMdtRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { text: string })
  .handler(async ({ data }) => {
    const parser = await import("node-weakauras-parser")
    const decoded = await parser.decode(data.text)
    return mdtRouteToPlannerRoute(decoded as ReturnType<typeof plannerRouteToMdtRoute>)
  })
