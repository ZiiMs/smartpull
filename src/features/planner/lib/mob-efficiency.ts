import type { Mob } from "@/features/planner/types"

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10
}

function toHexChannel(value: number) {
  return Math.round(clamp(value, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")
}

export function calculateMobEfficiencyScore(
  mob: Pick<Mob, "count" | "health">,
  dungeonTotalCount: number,
) {
  if (mob.count <= 0 || mob.health <= 0 || dungeonTotalCount <= 0) {
    return 0
  }

  return 2.5 * (mob.count / dungeonTotalCount) * 13000 / (mob.health / 20000)
}

export function getMobEfficiencyColor(score: number) {
  const value = score / 10
  const red = clamp(2 * (1 - value), 0, 1)
  const green = clamp(2 * value, 0, 1)
  return `#${toHexChannel(red)}${toHexChannel(green)}00`
}

export function formatMobEfficiencyScore(score: number) {
  return roundToTenths(score).toFixed(1)
}

export function getMobEfficiencyDisplay(
  mob: Pick<Mob, "count" | "health">,
  dungeonTotalCount: number,
) {
  const score = calculateMobEfficiencyScore(mob, dungeonTotalCount)

  return {
    score,
    label: formatMobEfficiencyScore(score),
    color: getMobEfficiencyColor(score),
  }
}
