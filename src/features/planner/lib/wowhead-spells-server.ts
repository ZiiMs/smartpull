import { createServerFn } from "@tanstack/react-start"

import { getWowheadSpellUrl } from "@/features/planner/lib/wowhead"

export type WowheadSpellDetails = {
  id: number
  name: string
  details: string[]
  description: string | null
  iconUrl: string | null
  url: string
}

const spellCache = new Map<number, WowheadSpellDetails | null>()

function decodeHtml(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

function normalizeEmbeddedJsString(value: string) {
  return decodeHtml(
    value
      .replaceAll('\\"', '"')
      .replaceAll("\\/", "/")
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\n"),
  )
}

function matchMeta(html: string, property: string) {
  const pattern = new RegExp(
    `<meta\\s+property="${property}"\\s+content="([^"]*)"`,
    "i",
  )
  const match = html.match(pattern)
  return match ? decodeHtml(match[1]) : null
}

function isGenericDescription(value: string | null) {
  if (!value) {
    return true
  }

  return (
    value.startsWith("In the ") ||
    value.includes("Added in World of Warcraft") ||
    value.includes("Always up to date")
  )
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
}

function extractTooltipParts(html: string, spellId: number) {
  const tooltipPattern = new RegExp(
    `g_spells\\[${spellId}\\]\\.tooltip_enus = "((?:\\\\.|[^"])*)"`,
  )
  const tooltipMatch = html.match(tooltipPattern)
  if (tooltipMatch) {
    const tooltip = normalizeEmbeddedJsString(tooltipMatch[1])
    const tables = [...tooltip.matchAll(/<table>([\s\S]*?)<\/table>/g)].map(
      (match) => match[1],
    )

    const detailsTable = tables[0] ?? ""
    const descriptionTable = tables[1] ?? ""

    const details = [...detailsTable.matchAll(/<br\s*\/?>/g)].length
      ? detailsTable
          .split(/<br\s*\/?>/i)
          .map((line) => stripTags(line))
          .filter(Boolean)
          .filter((line) => line !== (matchMeta(html, "og:title") ?? `Spell ${spellId}`))
      : []

    const descriptionMatch = descriptionTable.match(
      /<div[^>]*class="q"[^>]*>([\s\S]*?)<\/div>/,
    )

    const fallbackDescriptionMatch = tooltip.match(
      /<div[^>]*class="q"[^>]*>([\s\S]*?)<\/div>/,
    )

    return {
      details,
      description: descriptionMatch
        ? stripTags(descriptionMatch[1])
        : fallbackDescriptionMatch
          ? stripTags(fallbackDescriptionMatch[1])
          : null,
    }
  }

  const descriptionPattern = new RegExp(
    `"${spellId}"\\s*:\\s*\\{[^}]*"description_enus":"((?:\\\\.|[^"])*)"`,
  )
  const descriptionMatch = html.match(descriptionPattern)

  return {
    details: [],
    description: descriptionMatch
      ? stripTags(normalizeEmbeddedJsString(descriptionMatch[1]))
      : matchMeta(html, "og:description"),
  }
}

async function fetchSpellDetails(spellId: number) {
  const cached = spellCache.get(spellId)
  if (
    cached !== undefined &&
    cached !== null &&
    Array.isArray(cached.details) &&
    (cached.description !== null || cached.details.length > 0)
  ) {
    return cached
  }

  const url = getWowheadSpellUrl(spellId)
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "smartpull/1.0",
    },
  })

  if (!response.ok) {
    spellCache.set(spellId, null)
    return null
  }

  const html = await response.text()
  const tooltipParts = extractTooltipParts(html, spellId)
  const metaDescription = matchMeta(html, "og:description")
  const details = {
    id: spellId,
    name: matchMeta(html, "og:title") ?? `Spell ${spellId}`,
    details: tooltipParts.details,
    description: tooltipParts.description ?? (isGenericDescription(metaDescription) ? null : metaDescription),
    iconUrl: matchMeta(html, "og:image"),
    url,
  } satisfies WowheadSpellDetails

  spellCache.set(spellId, details)
  return details
}

export const getWowheadSpellDetails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { spellIds: number[] })
  .handler(async ({ data }) => {
    const spellIds = [...new Set(data.spellIds)]
      .filter((spellId) => Number.isInteger(spellId) && spellId > 0)
      .slice(0, 50)

    const details = await Promise.all(spellIds.map(fetchSpellDetails))
    return details.filter(
      (detail): detail is WowheadSpellDetails => detail !== null,
    )
  })
