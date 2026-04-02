import { createError, defineEventHandler, readBody } from "h3"

import { plannerRouteToMdtRoute } from "@/features/planner/lib/mdt-codec"
import type { PlannerRoute } from "@/features/planner/types"

export default defineEventHandler(async (event) => {
  const body = await readBody<{ route: PlannerRoute }>(event)
  if (!body?.route) {
    throw createError({ statusCode: 400, statusMessage: "Missing route payload" })
  }
  const parser = (await import("node-weakauras-parser")).default
  return parser.encode(plannerRouteToMdtRoute(body.route), 1)
})
