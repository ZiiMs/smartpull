import { randomBytes } from "node:crypto"
import { createClient, type Client } from "@libsql/client"

import type { PlannerRoute } from "../src/features/planner/types"

const shareIdAlphabet = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
const shareLifetimeMonths = 6

type ShareDatabaseGlobal = typeof globalThis & {
  __smartRouteShareClient?: Client
  __smartRouteShareSchemaPromise?: Promise<void>
}

function getTursoEnv(name: "TURSO_DATABASE_URL" | "TURSO_AUTH_TOKEN") {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required ${name} environment variable for share links`,
    )
  }

  return value
}

function getShareClient() {
  const globalState = globalThis as ShareDatabaseGlobal
  if (!globalState.__smartRouteShareClient) {
    globalState.__smartRouteShareClient = createClient({
      url: getTursoEnv("TURSO_DATABASE_URL"),
      authToken: getTursoEnv("TURSO_AUTH_TOKEN"),
    })
  }

  return globalState.__smartRouteShareClient
}

function isDuplicateColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("duplicate column name")
}

async function ensureShareSchema() {
  const globalState = globalThis as ShareDatabaseGlobal
  if (!globalState.__smartRouteShareSchemaPromise) {
    const client = getShareClient()
    globalState.__smartRouteShareSchemaPromise = (async () => {
      await client.batch(
        [
          "CREATE TABLE IF NOT EXISTS shared_routes (id TEXT PRIMARY KEY, route_json TEXT NOT NULL, route_name TEXT NOT NULL, dungeon_key TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT)",
          "CREATE INDEX IF NOT EXISTS shared_routes_created_at_idx ON shared_routes (created_at DESC)",
        ],
        "write",
      )

      try {
        await client.execute(
          "ALTER TABLE shared_routes ADD COLUMN expires_at TEXT",
        )
      } catch (error) {
        if (!isDuplicateColumnError(error)) {
          throw error
        }
      }

      await client.execute(
        "CREATE INDEX IF NOT EXISTS shared_routes_expires_at_idx ON shared_routes (expires_at)",
      )
    })()
  }

  await globalState.__smartRouteShareSchemaPromise
}

function createShareId(length = 8) {
  const bytes = randomBytes(length)
  return Array.from(
    bytes,
    (byte) => shareIdAlphabet[byte % shareIdAlphabet.length],
  ).join("")
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date)
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months)
  return nextDate
}

function isPlannerRoute(value: unknown): value is PlannerRoute {
  if (!value || typeof value !== "object") {
    return false
  }

  const route = value as Partial<PlannerRoute>
  return (
    typeof route.id === "string" &&
    typeof route.name === "string" &&
    typeof route.dungeonKey === "string" &&
    Array.isArray(route.pulls) &&
    Array.isArray(route.notes) &&
    Array.isArray(route.drawings)
  )
}

function getExpiresAtState(expiresAt: unknown) {
  if (typeof expiresAt !== "string") {
    return "missing"
  }

  const expiresAtTime = Date.parse(expiresAt)
  if (Number.isNaN(expiresAtTime)) {
    return "missing"
  }

  return expiresAtTime <= Date.now() ? "expired" : "active"
}

export async function createSharedRouteRecord(route: PlannerRoute, existingShareId?: string) {
  await ensureShareSchema()

  const client = getShareClient()
  const routeJson = JSON.stringify(route)
  const createdAtDate = new Date()
  const createdAt = createdAtDate.toISOString()
  const expiresAt = addMonths(createdAtDate, shareLifetimeMonths).toISOString()

  if (existingShareId) {
    const existingRoute = await client.execute({
      sql: "SELECT id, expires_at FROM shared_routes WHERE id = ? LIMIT 1",
      args: [existingShareId],
    })
    const existingRow = existingRoute.rows[0]

    if (existingRow) {
      const expiresAtState = getExpiresAtState(existingRow.expires_at)
      if (expiresAtState === "active") {
        await client.execute({
          sql: "UPDATE shared_routes SET route_json = ?, route_name = ?, dungeon_key = ? WHERE id = ?",
          args: [routeJson, route.name, route.dungeonKey, existingShareId],
        })
        return existingShareId
      }

      if (expiresAtState === "missing") {
        await client.execute({
          sql: "UPDATE shared_routes SET route_json = ?, route_name = ?, dungeon_key = ?, expires_at = ? WHERE id = ?",
          args: [routeJson, route.name, route.dungeonKey, expiresAt, existingShareId],
        })
        return existingShareId
      }
    } else {
      await client.execute({
        sql: "INSERT INTO shared_routes (id, route_json, route_name, dungeon_key, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [
          existingShareId,
          routeJson,
          route.name,
          route.dungeonKey,
          createdAt,
          expiresAt,
        ],
      })
      return existingShareId
    }
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const shareId = createShareId()

    try {
      await client.execute({
        sql: "INSERT INTO shared_routes (id, route_json, route_name, dungeon_key, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [
          shareId,
          routeJson,
          route.name,
          route.dungeonKey,
          createdAt,
          expiresAt,
        ],
      })
      return shareId
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("UNIQUE") || message.includes("PRIMARY KEY")) {
        continue
      }

      throw error
    }
  }

  throw new Error("Could not allocate a unique share id")
}

export async function getSharedRouteRecord(shareId: string) {
  await ensureShareSchema()

  const client = getShareClient()
  const result = await client.execute({
    sql: "SELECT route_json, expires_at FROM shared_routes WHERE id = ? LIMIT 1",
    args: [shareId],
  })
  const row = result.rows[0]

  if (!row) {
    return null
  }

  const expiresAt = row.expires_at
  if (typeof expiresAt === "string") {
    const expiresAtTime = Date.parse(expiresAt)
    if (Number.isNaN(expiresAtTime) || expiresAtTime <= Date.now()) {
      return null
    }
  }

  const routeJson = row.route_json
  if (typeof routeJson !== "string") {
    throw new Error("Stored share payload is invalid")
  }

  const parsed = JSON.parse(routeJson) as unknown
  if (!isPlannerRoute(parsed)) {
    throw new Error("Stored share payload is invalid")
  }

  return parsed
}
