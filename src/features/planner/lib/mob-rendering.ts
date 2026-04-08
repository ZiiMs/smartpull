import { mapWidth, pointToLngLat } from "@/features/planner/lib/map"
import { mobScale } from "@/features/planner/lib/mob-spawns"
import type {
  DungeonKey,
  MobSpawn,
  SpawnId,
} from "@/features/planner/types"
import type { Feature, FeatureCollection, Point as GeoJsonPoint } from "geojson"
import type maplibregl from "maplibre-gl"

const plannerMobSpritePrefix = "planner-mob-sprite"
const plannerMobSpriteCanvasSize = 160
const plannerMobSpriteLayoutSize = 116
const plannerMobScaleBase = 4
const mercatorPixelsPerDegreeAtZoom0 = 512 / 360
const plannerMobMinPixelsPerScale = 16

export const plannerMobPortraitFallbackSrc = "/images/markers/skull.png"
export const plannerMobSpriteSize = plannerMobSpriteLayoutSize
export const plannerMobMinPixelsPerScaleAtLowZoom = plannerMobMinPixelsPerScale

const missingPlannerMobPortraitIds = new Set<number>()
const plannerMobSpriteCache = new globalThis.Map<
  string,
  Promise<ImageBitmap | ImageData>
>()

export type PlannerMobFeatureProperties = {
  forceLabel: string
  forceLabelScale: number
  group: number | null
  groupLabel: string
  groupLabelScale: number
  isBoss: boolean
  markerScale: number
  mobId: number
  pullColor: string | null
  selectedRingColor: string | null
  selected: boolean
  spawnId: SpawnId
  spriteId: string
}

export type PlannerMobFeature = Feature<
  GeoJsonPoint,
  PlannerMobFeatureProperties
>

export type PlannerMobFeatureCollection = FeatureCollection<
  GeoJsonPoint,
  PlannerMobFeatureProperties
>

export type PlannerMobComputedMetrics = {
  zoom: number
  basePixelsPerScale: number
  markerScale: number
  ringRadius: number
  ringDiameter: number
  portraitDiameter: number
  forceLabelSize: number
  groupLabelSize: number
  forceLabel: string
  groupLabel: string
}

export function formatPlannerMobForces(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

export function createPlannerMobSpriteId(
  dungeonKey: DungeonKey,
  mobId: number,
) {
  return `${plannerMobSpritePrefix}:${dungeonKey}:${mobId}`
}

export function parsePlannerMobSpriteId(spriteId: string): {
  dungeonKey: DungeonKey
  mobId: number
} | null {
  const [prefix, dungeonKey, mobIdValue] = spriteId.split(":")
  if (
    prefix !== plannerMobSpritePrefix ||
    !dungeonKey ||
    !mobIdValue
  ) {
    return null
  }

  const mobId = Number(mobIdValue)
  if (!Number.isInteger(mobId) || mobId <= 0) {
    return null
  }

  return {
    dungeonKey: dungeonKey as DungeonKey,
    mobId,
  }
}

export function resolvePlannerMobPortraitSrc(
  mobId: number,
  missingPortraitIds: ReadonlySet<number> = missingPlannerMobPortraitIds,
) {
  return missingPortraitIds.has(mobId)
    ? plannerMobPortraitFallbackSrc
    : `/npc_portraits/${mobId}.png`
}

export function plannerMobPixelsPerScaleAtZoom(zoom: number) {
  return (
    plannerMobScaleBase *
    mercatorPixelsPerDegreeAtZoom0 *
    (2 ** zoom / mapWidth)
  )
}

export function effectivePlannerMobPixelsPerScaleAtZoom(zoom: number) {
  return Math.max(
    plannerMobPixelsPerScaleAtZoom(zoom) * (zoom >= 14 ? 1.12 : 1),
    plannerMobMinPixelsPerScale,
  )
}

export function getPlannerMobComputedMetrics(
  mobSpawn: MobSpawn,
  zoom: number,
): PlannerMobComputedMetrics {
  const basePixelsPerScale = effectivePlannerMobPixelsPerScaleAtZoom(zoom)
  const markerScale = mobScale(mobSpawn)
  const forceLabel = formatPlannerMobForces(mobSpawn.mob.count)
  const groupLabel =
    mobSpawn.spawn.group != null ? `G${mobSpawn.spawn.group}` : ""
  const forceLabelScale = Math.min(1, 1.8 / forceLabel.length)
  const groupLabelScale = groupLabel
    ? Math.min(1, 1.8 / groupLabel.length)
    : 1

  const ringRadius = markerScale * basePixelsPerScale * 0.505
  const portraitDiameter = markerScale * basePixelsPerScale * 0.92
  const forceLabelSize = Math.min(
    markerScale * forceLabelScale * basePixelsPerScale * 0.7,
    254,
  )
  const groupLabelSize = Math.min(
    markerScale * groupLabelScale * basePixelsPerScale * 0.7,
    254,
  )

  return {
    zoom,
    basePixelsPerScale,
    markerScale,
    ringRadius,
    ringDiameter: ringRadius * 2,
    portraitDiameter,
    forceLabelSize,
    groupLabelSize,
    forceLabel,
    groupLabel,
  }
}

export function darkenPlannerMobColor(color: string, factor = 0.5) {
  const normalized = color.replace("#", "")
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((channel) => `${channel}${channel}`)
          .join("")
      : normalized

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return color
  }

  const darkenChannel = (offset: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(Number.parseInt(expanded.slice(offset, offset + 2), 16) * factor),
      ),
    )

  return `#${[0, 2, 4]
    .map((offset) => darkenChannel(offset).toString(16).padStart(2, "0"))
    .join("")}`
}

export function buildPlannerMobFeatureCollection({
  dungeonKey,
  mobSpawns,
  pullColorBySpawn,
  selectedSpawnIds,
}: {
  dungeonKey: DungeonKey
  mobSpawns: MobSpawn[]
  pullColorBySpawn: ReadonlyMap<SpawnId, string>
  selectedSpawnIds: ReadonlySet<SpawnId>
}): PlannerMobFeatureCollection {
  return {
    type: "FeatureCollection",
    features: mobSpawns.map((mobSpawn) => {
      const spawnId = mobSpawn.spawn.id
      const forceLabel = formatPlannerMobForces(mobSpawn.mob.count)
      const groupLabel =
        mobSpawn.spawn.group != null ? `G${mobSpawn.spawn.group}` : ""
      const pullColor = pullColorBySpawn.get(spawnId) ?? null

      return {
        type: "Feature",
        id: spawnId,
        properties: {
          forceLabel,
          forceLabelScale: Math.min(1, 1.8 / forceLabel.length),
          group: mobSpawn.spawn.group ?? null,
          groupLabel,
          groupLabelScale: groupLabel
            ? Math.min(1, 1.8 / groupLabel.length)
            : 1,
          isBoss: mobSpawn.mob.isBoss,
          markerScale: mobScale(mobSpawn),
          mobId: mobSpawn.mob.id,
          pullColor,
          selectedRingColor: pullColor ? darkenPlannerMobColor(pullColor) : null,
          selected: selectedSpawnIds.has(spawnId),
          spawnId,
          spriteId: createPlannerMobSpriteId(dungeonKey, mobSpawn.mob.id),
        },
        geometry: {
          type: "Point",
          coordinates: pointToLngLat(mobSpawn.spawn.pos),
        },
      }
    }),
  }
}

export async function ensurePlannerMobSprites(
  map: maplibregl.Map,
  dungeonKey: DungeonKey,
  mobSpawns: MobSpawn[],
) {
  const uniqueMobIds = [...new Set(mobSpawns.map(({ mob }) => mob.id))]

  await Promise.all(
    uniqueMobIds.map((mobId) => ensurePlannerMobSprite(map, dungeonKey, mobId)),
  )
}

export async function ensurePlannerMobSprite(
  map: maplibregl.Map,
  dungeonKey: DungeonKey,
  mobId: number,
) {
  const spriteId = createPlannerMobSpriteId(dungeonKey, mobId)
  if (map.hasImage(spriteId)) {
    return
  }

  const sprite = await getPlannerMobSprite(spriteId, mobId)
  if (!map.hasImage(spriteId)) {
    map.addImage(spriteId, sprite)
  }
}

async function getPlannerMobSprite(spriteId: string, mobId: number) {
  const cachedSprite = plannerMobSpriteCache.get(spriteId)
  if (cachedSprite) {
    return cachedSprite
  }

  const pendingSprite = loadPlannerMobSprite(mobId)
  plannerMobSpriteCache.set(spriteId, pendingSprite)

  try {
    return await pendingSprite
  } catch (error) {
    plannerMobSpriteCache.delete(spriteId)
    throw error
  }
}

async function loadPlannerMobSprite(mobId: number) {
  const portrait = await loadPlannerMobPortrait(mobId)
  const canvas = document.createElement("canvas")
  canvas.width = plannerMobSpriteCanvasSize
  canvas.height = plannerMobSpriteCanvasSize

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not create planner mob sprite context.")
  }

  drawPlannerMobSprite(context, portrait)

  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(canvas)
    } catch {
      // Fall back to ImageData for environments without ImageBitmap support.
    }
  }

  return context.getImageData(0, 0, canvas.width, canvas.height)
}

async function loadPlannerMobPortrait(mobId: number) {
  const portraitSrc = resolvePlannerMobPortraitSrc(mobId)

  try {
    return await loadImage(portraitSrc)
  } catch (error) {
    if (portraitSrc === plannerMobPortraitFallbackSrc) {
      throw error
    }

    missingPlannerMobPortraitIds.add(mobId)
    return loadImage(plannerMobPortraitFallbackSrc)
  }
}

function drawPlannerMobSprite(
  context: CanvasRenderingContext2D,
  portrait: CanvasImageSource,
) {
  const size = plannerMobSpriteCanvasSize
  const center = size / 2
  const portraitSize = plannerMobSpriteLayoutSize
  const portraitRadius = portraitSize / 2
  const portraitOffset = center - portraitRadius

  context.clearRect(0, 0, size, size)

  context.save()
  context.beginPath()
  context.arc(center, center, portraitRadius, 0, Math.PI * 2)
  context.closePath()
  context.clip()
  context.drawImage(
    portrait,
    portraitOffset,
    portraitOffset,
    portraitSize,
    portraitSize,
  )
  context.restore()

  const glossGradient = context.createLinearGradient(0, center - portraitRadius, 0, center + portraitRadius)
  glossGradient.addColorStop(0, "rgba(255, 255, 255, 0.24)")
  glossGradient.addColorStop(0.48, "rgba(255, 255, 255, 0)")
  glossGradient.addColorStop(1, "rgba(255, 255, 255, 0.06)")
  context.fillStyle = glossGradient
  context.beginPath()
  context.arc(center, center, portraitRadius, Math.PI, Math.PI * 2)
  context.fill()
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = "async"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image: ${src}`))
    image.src = src
  })
}
