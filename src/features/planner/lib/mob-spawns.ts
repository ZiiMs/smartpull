import type {
  Mob,
  MobSpawn,
  SpawnId,
} from "@/features/planner/types"

const seasonalMobIds = [
  185685, 185683, 185680, 179891, 179892, 179890, 179446,
]

export function mdtEnemiesToMobSpawns(mobs: Mob[]) {
  return mobs
    .filter(({ id }) => !seasonalMobIds.includes(id))
    .reduce<Record<SpawnId, MobSpawn>>((acc, mob) => {
      mob.spawns.forEach((spawn) => {
        acc[spawn.id] = { mob, spawn }
      })
      return acc
    }, {})
}

export function countForSpawns(spawns: SpawnId[], mobSpawns: Record<SpawnId, MobSpawn>) {
  return spawns.reduce((total, spawnId) => total + (mobSpawns[spawnId]?.mob.count ?? 0), 0)
}

export function summarizeSpawnsByMob(
  spawns: SpawnId[],
  mobSpawns: Record<SpawnId, MobSpawn>,
) {
  const summary = new Map<
    number,
    { id: number; name: string; count: number; forces: number }
  >()

  for (const spawnId of spawns) {
    const mobSpawn = mobSpawns[spawnId]
    if (!mobSpawn) {
      continue
    }

    const existing = summary.get(mobSpawn.mob.id)
    if (existing) {
      existing.count += 1
      existing.forces += mobSpawn.mob.count
      continue
    }

    summary.set(mobSpawn.mob.id, {
      id: mobSpawn.mob.id,
      name: mobSpawn.mob.name,
      count: 1,
      forces: mobSpawn.mob.count,
    })
  }

  return [...summary.values()].sort((left, right) => {
    if (right.forces !== left.forces) {
      return right.forces - left.forces
    }

    if (right.count !== left.count) {
      return right.count - left.count
    }

    return left.name.localeCompare(right.name)
  })
}

export function mobScale(mobSpawn: MobSpawn) {
  return (mobSpawn.mob.scale ?? 1) * (mobSpawn.spawn.scale ?? 1) * (mobSpawn.mob.isBoss ? 1.7 : 1)
}
