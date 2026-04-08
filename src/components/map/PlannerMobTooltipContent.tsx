import { getMobEfficiencyDisplay } from "@/features/planner/lib/mob-efficiency"
import { formatPlannerMobForces } from "@/features/planner/lib/mob-rendering"
import type { MobSpawn } from "@/features/planner/types"

function formatEnemyForces(value: number, total: number) {
  const percent = (value / total) * 100
  const formattedPercent = Number.isInteger(percent)
    ? percent.toFixed(0)
    : percent.toFixed(1)

  return `${formatPlannerMobForces(value)} / ${total} (${formattedPercent}%)`
}

export default function PlannerMobTooltipContent({
  mobSpawn,
  pullIndex,
  totalEnemyForces,
}: {
  mobSpawn: MobSpawn
  pullIndex?: number
  totalEnemyForces: number
}) {
  const efficiency = getMobEfficiencyDisplay(mobSpawn.mob, totalEnemyForces)

  return (
    <div className="min-w-40 z-50 space-y-1">
      <div className="text-[13px] font-semibold tracking-[0.01em] text-amber-100">
        {mobSpawn.mob.name}
      </div>
      <div className="text-[12px] leading-snug text-stone-200/92">
        Enemy forces: {formatEnemyForces(mobSpawn.mob.count, totalEnemyForces)}
      </div>
      <div className="text-[12px] leading-snug text-stone-200/92">
        Efficiency Score:{" "}
        <span style={{ color: efficiency.color }}>{efficiency.label}</span>
      </div>
      {mobSpawn.spawn.group != null ? (
        <div className="text-[12px] leading-snug text-stone-200/92">
          Group {mobSpawn.spawn.group}
        </div>
      ) : null}
      <div className="text-[12px] leading-snug text-stone-200/92">
        {mobSpawn.mob.isBoss ? "Boss" : mobSpawn.mob.creatureType || "Trash pack"}
      </div>
      {pullIndex !== undefined ? (
        <div className="text-[12px] leading-snug text-stone-200/92">
          Assigned to Pull {pullIndex + 1}
        </div>
      ) : null}
    </div>
  )
}
