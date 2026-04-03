import { pointToLngLat } from "@/features/planner/lib/map"
import { formatPlannerMobForces } from "@/features/planner/lib/mob-rendering"
import { mobScale } from "@/features/planner/lib/mob-spawns"
import type { MobSpawn } from "@/features/planner/types"
import MapLibreGL from "maplibre-gl"
import { createPortal } from "react-dom"
import { useEffect, useMemo } from "react"

import { useMap } from "../ui/map"

function formatEnemyForces(value: number, total: number) {
  const percent = (value / total) * 100
  const formattedPercent = Number.isInteger(percent)
    ? percent.toFixed(0)
    : percent.toFixed(1)

  return `${formatPlannerMobForces(value)} / ${total} (${formattedPercent}%)`
}

export default function PlannerMobHoverPopup({
  mobSpawn,
  pullIndex,
  totalEnemyForces,
}: {
  mobSpawn: MobSpawn | null
  pullIndex?: number
  totalEnemyForces: number
}) {
  const { map } = useMap()
  const container = useMemo(() => document.createElement("div"), [])

  const popup = useMemo(
    () =>
      new MapLibreGL.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
      }).setMaxWidth("none"),
    [],
  )

  useEffect(() => {
    if (!map || !mobSpawn) {
      popup.remove()
      return
    }

    const [longitude, latitude] = pointToLngLat(mobSpawn.spawn.pos)
    popup
      .setDOMContent(container)
      .setOffset([0, -(10 + mobScale(mobSpawn) * 8)])
      .setLngLat([longitude, latitude])
      .addTo(map)

    return () => {
      popup.remove()
    }
  }, [container, map, mobSpawn, popup])

  if (!mobSpawn) {
    return null
  }

  return createPortal(
    <div className="border z-50 min-w-40 border-border bg-popover px-3 py-2 text-stone-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
      <div className="space-y-1">
        {[
          mobSpawn.mob.name,
          `Enemy forces: ${formatEnemyForces(mobSpawn.mob.count, totalEnemyForces)}`,
          mobSpawn.spawn.group != null ? `Group ${mobSpawn.spawn.group}` : null,
          mobSpawn.mob.isBoss
            ? "Boss"
            : mobSpawn.mob.creatureType || "Trash pack",
          pullIndex !== undefined ? `Assigned to Pull ${pullIndex + 1}` : null,
        ]
          .filter(Boolean)
          .map((line, index) => (
            <div
              key={line}
              className={
                index === 0
                  ? "text-[13px] font-semibold tracking-[0.01em] text-amber-100"
                  : "text-[12px] leading-snug text-stone-200/92"
              }
            >
              {line}
            </div>
          ))}
      </div>
    </div>,
    container,
  )
}
