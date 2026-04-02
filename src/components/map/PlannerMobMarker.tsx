import { MobIconMarkup } from "@/features/planner/components/map/mob-icon"
import { pointToLngLat } from "@/features/planner/lib/map"
import { mobScale } from "@/features/planner/lib/mob-spawns"
import type { usePlannerStore } from "@/features/planner/store/planner-store"
import type { MobSpawn } from "@/features/planner/types"
import { memo, type MouseEvent as ReactMouseEvent } from "react"
import { MapMarker, MarkerContent, MarkerTooltip } from "../ui/map"

const PlannerMobMarker = memo(function PlannerMobMarker({
  mobSpawn,
  pullColor,
  isSelected,
  pullIndex,
  onHoverStart,
  onHoverEnd,
  onContextMenu,
  toggleSpawn,
  totalEnemyForces,
}: {
  mobSpawn: MobSpawn
  pullColor?: string
  isSelected: boolean
  pullIndex?: number
  onHoverStart: (spawnId: string, group: number | null) => void
  onHoverEnd: (spawnId: string) => void
  onContextMenu: (
    event: ReactMouseEvent<HTMLDivElement>,
    mobSpawn: MobSpawn,
  ) => void
  toggleSpawn: ReturnType<typeof usePlannerStore.getState>["toggleSpawn"]
  totalEnemyForces: number
}) {
  const markerScale = mobScale(mobSpawn)
  const spawnId = mobSpawn.spawn.id
  const group = mobSpawn.spawn.group
  const [longitude, latitude] = pointToLngLat(mobSpawn.spawn.pos)

  function popupOffset(scale: number) {
    return [0, -(10 + scale * 8)] as [number, number]
  }

  function formatForces(value: number) {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1)
  }

  function formatEnemyForces(value: number, total: number) {
    const percent = (value / total) * 100
    const formattedPercent = Number.isInteger(percent)
      ? percent.toFixed(0)
      : percent.toFixed(1)
    return `${formatForces(value)} / ${total} (${formattedPercent}%)`
  }

  return (
    <MapMarker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        toggleSpawn(spawnId, {
          individual: event.ctrlKey || event.metaKey,
        })
      }}
      onMouseEnter={() => {
        onHoverStart(spawnId, group)
      }}
      onMouseLeave={() => {
        onHoverEnd(spawnId)
      }}
    >
      <MarkerContent className="planner-map-mob-icon-root">
        <div
          className="planner-map-mob-marker relative"
          data-planner-mob-marker="true"
          data-planner-mob-group={group ?? ""}
          style={{
            ["--planner-marker-scale" as string]: String(markerScale),
          }}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onContextMenu(event, mobSpawn)
          }}
        >
          <MobIconMarkup
            marker={{
              markerScale,
              mobSpawn,
              pullColor,
              isSelected,
              group,
            }}
          />
        </div>
      </MarkerContent>
      <MarkerTooltip
        offset={popupOffset(markerScale)}
        className="border z-50 border-border bg-popover px-3 py-2 text-stone-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-[2px]"
      >
        <div className="min-w-40 z-50 space-y-1">
          {[
            mobSpawn.mob.name,
            `Enemy forces: ${formatEnemyForces(mobSpawn.mob.count, totalEnemyForces)}`,
            group != null ? `Group ${group}` : null,
            mobSpawn.mob.isBoss
              ? "Boss"
              : mobSpawn.mob.creatureType || "Trash pack",
            pullIndex !== undefined
              ? `Assigned to Pull ${pullIndex + 1}`
              : null,
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
      </MarkerTooltip>
    </MapMarker>
  )
})

export default PlannerMobMarker
