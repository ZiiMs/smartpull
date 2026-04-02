import { createError, defineEventHandler, readBody } from "h3"

import { mdtRouteToPlannerRoute } from "@/features/planner/lib/mdt-codec"
import type { MdtRoute } from "@/features/planner/types"

export default defineEventHandler(async (event) => {
  const body = await readBody<{ text: string }>(event)
  if (!body?.text) {
    throw createError({ statusCode: 400, statusMessage: "Missing MDT string" })
  }

  try {
    const parser = (await import("node-weakauras-parser")).default
    const decoded = (await parser.decode(body.text.trim())) as MdtRoute
    return mdtRouteToPlannerRoute(decoded)
  } catch {
    throw createError({
      statusCode: 422,
      statusMessage: "Invalid MDT string",
    })
  }
})
