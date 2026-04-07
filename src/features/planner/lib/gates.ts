import type { PlannerSticker, Point } from "@/features/planner/types"

export const warlockGateMaxRange = 40

export type WarlockGateConnection = {
  id: string
  originId: string
  destinationId: string
  originPosition: Point
  destinationPosition: Point
  distance: number
  withinRange: boolean
}

const emptyPointOverrides = new Map<string, Point>()

export function getPlannerPointDistance(left: Point, right: Point) {
  return Math.hypot(right[0] - left[0], right[1] - left[1])
}

export function clampPlannerPointToRange(
  origin: Point,
  target: Point,
  maxDistance = warlockGateMaxRange,
): Point {
  const distance = getPlannerPointDistance(origin, target)
  if (distance <= maxDistance || distance === 0) {
    return target
  }

  const scale = maxDistance / distance
  return [
    origin[0] + (target[0] - origin[0]) * scale,
    origin[1] + (target[1] - origin[1]) * scale,
  ]
}

export function getWarlockGateConnections(
  stickers: PlannerSticker[],
  pointOverrides: ReadonlyMap<string, Point> = emptyPointOverrides,
) {
  const gateStickers = stickers.filter((sticker) => sticker.kind === "warlockGate")
  const connections: WarlockGateConnection[] = []

  for (let index = 0; index < gateStickers.length - 1; index += 2) {
    const origin = gateStickers[index]
    const destination = gateStickers[index + 1]
    if (!origin || !destination) {
      continue
    }

    const originPosition = pointOverrides.get(origin.id) ?? origin.position
    const destinationPosition =
      pointOverrides.get(destination.id) ?? destination.position
    const distance = getPlannerPointDistance(originPosition, destinationPosition)

    connections.push({
      id: `${origin.id}-${destination.id}`,
      originId: origin.id,
      destinationId: destination.id,
      originPosition,
      destinationPosition,
      distance,
      withinRange: distance <= warlockGateMaxRange,
    })
  }

  return connections
}

export function getUnpairedWarlockGate(
  stickers: PlannerSticker[],
  pointOverrides: ReadonlyMap<string, Point> = emptyPointOverrides,
) {
  const gateStickers = stickers.filter((sticker) => sticker.kind === "warlockGate")
  if (gateStickers.length % 2 === 0) {
    return null
  }

  const gate = gateStickers.at(-1)
  if (!gate) {
    return null
  }

  return {
    id: gate.id,
    position: pointOverrides.get(gate.id) ?? gate.position,
  }
}
