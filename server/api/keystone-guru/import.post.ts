import { createError, defineEventHandler, readBody } from "h3"

import { importKeystoneGuruRoute } from "../../keystone-guru"

export default defineEventHandler(async (event) => {
  const body = await readBody<{ input: string }>(event)
  if (!body?.input) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing Keystone.Guru URL or slug",
    })
  }

  try {
    return await importKeystoneGuruRoute(body.input.trim())
  } catch (error) {
    throw createError({
      statusCode: 422,
      statusMessage:
        error instanceof Error
          ? error.message
          : "Could not import Keystone.Guru route",
    })
  }
})
