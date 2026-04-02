import type { PlannerRoute } from "@/features/planner/types"

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4))
  const binary = atob(base64 + padding)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeSharedRoute(route: PlannerRoute) {
  return toBase64Url(JSON.stringify(route))
}

export function decodeSharedRoute(payload: string) {
  const parsed = JSON.parse(fromBase64Url(payload)) as PlannerRoute
  if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.dungeonKey) {
    throw new Error("Invalid shared route")
  }
  return parsed
}
