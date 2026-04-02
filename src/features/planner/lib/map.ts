import type { DungeonKey, Point } from "@/features/planner/types"
import type { MapLibreMap } from "maplibre-gl"

export const mapHeight = 256
export const mapWidth = 384
export const stitchedTileHeight = 640
export const stitchedTileWidth = 640
export const stitchedTilesX = 6
export const stitchedTilesY = 4

const mapLngSpan = 1
const mapLatSpan = mapLngSpan * (mapHeight / mapWidth)
const plannerLatOffset = 0
const mapIconBaseScale = 4

// Bump this whenever map tiles or stitched-map behavior change so stale IndexedDB
// assets do not keep rendering against updated planner data.
export const plannerMapAssetVersion = 2
const dungeonMapCacheDatabaseName = "smart-route-planner-assets"
const dungeonMapCacheStoreName = "planner-dungeon-maps"
const stitchedMapCache = new globalThis.Map<string, Promise<DungeonMapAsset>>()
let dungeonMapDatabasePromise: Promise<IDBDatabase | null> | null = null

type CachedDungeonMapRecord = {
  key: string
  dungeonKey: DungeonKey
  version: number
  blob: Blob
  createdAt: number
}

export type DungeonMapAsset = {
  source: "memory" | "indexeddb" | "built"
  url: string
}

export const mapBounds: [[number, number], [number, number]] = [
  [0, -mapLatSpan],
  [mapLngSpan, 0],
]

export const mapCenter: [number, number] = [mapLngSpan / 2, -mapLatSpan / 2]

export function pointToLngLat(point: Point): [number, number] {
  const [lat, lng] = point
  return [
    (lng / mapWidth) * mapLngSpan,
    ((lat - plannerLatOffset) / mapHeight) * mapLatSpan,
  ]
}

export function lngLatToPoint(lngLat: { lng: number; lat: number }): Point {
  return [
    (lngLat.lat / mapLatSpan) * mapHeight + plannerLatOffset,
    (lngLat.lng / mapLngSpan) * mapWidth,
  ]
}

export function mapIconScaling(map: MapLibreMap) {
  const start = map.project(pointToLngLat([0, 0]))
  const end = map.project(pointToLngLat([0, 1]))
  const pixelsPerPlannerUnit = Math.hypot(end.x - start.x, end.y - start.y)
  return mapIconBaseScale * pixelsPerPlannerUnit
}

export function dungeonImageCoordinates(): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  return [
    [0, 0],
    [mapLngSpan, 0],
    [mapLngSpan, -mapLatSpan],
    [0, -mapLatSpan],
  ]
}

export function circlePolygon(center: Point, radius: number, steps = 32) {
  const points: Point[] = []

  for (let index = 0; index <= steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps
    points.push([
      center[0] + radius * Math.sin(angle),
      center[1] + radius * Math.cos(angle),
    ])
  }

  return points
}

export function hasStitchedDungeonMapInMemory(dungeonKey: DungeonKey) {
  return stitchedMapCache.has(createDungeonMapCacheKey(dungeonKey))
}

export async function stitchDungeonMap(dungeonKey: DungeonKey) {
  const cacheKey = createDungeonMapCacheKey(dungeonKey)
  const cached = stitchedMapCache.get(cacheKey)
  if (cached) {
    const asset = await cached
    return {
      source: "memory" as const,
      url: asset.url,
    }
  }

  const stitched = (async () => {
    const cachedBlob = await readCachedDungeonMapBlob(dungeonKey)
    if (cachedBlob) {
      return {
        source: "indexeddb" as const,
        url: URL.createObjectURL(cachedBlob),
      }
    }

    const blob = await buildStitchedDungeonMapBlob(dungeonKey)
    await writeCachedDungeonMapBlob(dungeonKey, blob)
    return {
      source: "built" as const,
      url: URL.createObjectURL(blob),
    }
  })()

  stitchedMapCache.set(cacheKey, stitched)

  try {
    return await stitched
  } catch (error) {
    stitchedMapCache.delete(cacheKey)
    throw error
  }
}

export async function warmDungeonMapAssets(dungeonKeys: DungeonKey[]) {
  for (const dungeonKey of dungeonKeys) {
    try {
      await stitchDungeonMap(dungeonKey)
    } catch {
      // Ignore warmup failures so one bad dungeon does not block the rest.
    }
  }
}

export function createDungeonMapCacheKey(dungeonKey: DungeonKey) {
  return `${plannerMapAssetVersion}:${dungeonKey}`
}

async function buildStitchedDungeonMapBlob(dungeonKey: DungeonKey) {
  const canvas = document.createElement("canvas")
  canvas.width = stitchedTileWidth * stitchedTilesX
  canvas.height = stitchedTileHeight * stitchedTilesY

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not create dungeon map canvas context.")
  }

  await Promise.all(
    Array.from(
      { length: stitchedTilesX * stitchedTilesY },
      async (_, index) => {
        const tileX = Math.floor(index / stitchedTilesY)
        const tileY = index % stitchedTilesY
        const image = await loadImage(
          `/maps/${dungeonKey}/${tileX}_${tileY}.jpg`,
        )
        context.drawImage(
          image,
          tileX * stitchedTileWidth,
          tileY * stitchedTileHeight,
          stitchedTileWidth,
          stitchedTileHeight,
        )
      },
    ),
  )

  const blob = await canvasToBlob(canvas, "image/jpeg", 0.92)
  if (!blob) {
    throw new Error("Could not serialize dungeon map canvas.")
  }

  return blob
}

async function readCachedDungeonMapBlob(dungeonKey: DungeonKey) {
  const database = await getDungeonMapDatabase()
  if (!database) {
    return null
  }

  return new Promise<Blob | null>((resolve) => {
    const transaction = database.transaction(
      dungeonMapCacheStoreName,
      "readonly",
    )
    const store = transaction.objectStore(dungeonMapCacheStoreName)
    const request = store.get(createDungeonMapCacheKey(dungeonKey))

    request.onsuccess = () => {
      const result = request.result as CachedDungeonMapRecord | undefined
      resolve(result?.blob ?? null)
    }
    request.onerror = () => resolve(null)
  })
}

async function writeCachedDungeonMapBlob(dungeonKey: DungeonKey, blob: Blob) {
  const database = await getDungeonMapDatabase()
  if (!database) {
    return
  }

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(
      dungeonMapCacheStoreName,
      "readwrite",
    )
    const store = transaction.objectStore(dungeonMapCacheStoreName)
    store.put({
      key: createDungeonMapCacheKey(dungeonKey),
      dungeonKey,
      version: plannerMapAssetVersion,
      blob,
      createdAt: Date.now(),
    } satisfies CachedDungeonMapRecord)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
}

async function getDungeonMapDatabase() {
  if (typeof indexedDB === "undefined") {
    return null
  }

  dungeonMapDatabasePromise ??= new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(dungeonMapCacheDatabaseName, 1)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(dungeonMapCacheStoreName)) {
        database.createObjectStore(dungeonMapCacheStoreName, {
          keyPath: "key",
        })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

  return dungeonMapDatabasePromise
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
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
