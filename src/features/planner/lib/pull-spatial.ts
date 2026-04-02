import { dungeonsByKey } from "@/features/planner/data/dungeons"
import type { DungeonKey, Point, SpawnId } from "@/features/planner/types"

const componentLinkThreshold = 24
const incoherentComponentDistanceThreshold = 40

export type PullSpatialDiagnostic = {
  spawnCount: number
  componentCount: number
  largestComponentSize: number
  maxComponentCentroidDistance: number
  isSpatiallyIncoherent: boolean
}

function distance(left: Point, right: Point) {
  return Math.hypot(left[0] - right[0], left[1] - right[1])
}

function centroid(points: Point[]) {
  const total = points.reduce<Point>(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0],
  )

  return [total[0] / points.length, total[1] / points.length] as Point
}

function connectedComponents(points: Point[]) {
  if (points.length === 0) {
    return []
  }

  const visited = new Set<number>()
  const components: Point[][] = []

  for (let index = 0; index < points.length; index += 1) {
    if (visited.has(index)) {
      continue
    }

    const stack = [index]
    const component: Point[] = []
    visited.add(index)

    while (stack.length > 0) {
      const currentIndex = stack.pop()
      if (currentIndex == null) {
        continue
      }

      const current = points[currentIndex]
      if (!current) {
        continue
      }

      component.push(current)

      for (let candidateIndex = 0; candidateIndex < points.length; candidateIndex += 1) {
        if (visited.has(candidateIndex)) {
          continue
        }

        const candidate = points[candidateIndex]
        if (!candidate) {
          continue
        }

        if (distance(current, candidate) <= componentLinkThreshold) {
          visited.add(candidateIndex)
          stack.push(candidateIndex)
        }
      }
    }

    components.push(component)
  }

  return components
}

export function getPullSpatialDiagnostic(dungeonKey: DungeonKey, spawnIds: SpawnId[]) {
  const dungeon = dungeonsByKey[dungeonKey]
  const points = spawnIds.flatMap((spawnId) => {
    const mobSpawn = dungeon.mobSpawns[spawnId]
    return mobSpawn ? [mobSpawn.spawn.pos] : []
  })

  if (points.length === 0) {
    return {
      spawnCount: 0,
      componentCount: 0,
      largestComponentSize: 0,
      maxComponentCentroidDistance: 0,
      isSpatiallyIncoherent: false,
    } satisfies PullSpatialDiagnostic
  }

  const components = connectedComponents(points)
  const centroids = components.map(centroid)
  let maxComponentCentroidDistance = 0

  for (let leftIndex = 0; leftIndex < centroids.length; leftIndex += 1) {
    const left = centroids[leftIndex]
    if (!left) {
      continue
    }

    for (let rightIndex = leftIndex + 1; rightIndex < centroids.length; rightIndex += 1) {
      const right = centroids[rightIndex]
      if (!right) {
        continue
      }

      maxComponentCentroidDistance = Math.max(
        maxComponentCentroidDistance,
        distance(left, right),
      )
    }
  }

  const largestComponentSize = components.reduce(
    (max, component) => Math.max(max, component.length),
    0,
  )

  return {
    spawnCount: points.length,
    componentCount: components.length,
    largestComponentSize,
    maxComponentCentroidDistance,
    isSpatiallyIncoherent:
      components.length > 1 &&
      maxComponentCentroidDistance >= incoherentComponentDistanceThreshold,
  } satisfies PullSpatialDiagnostic
}
