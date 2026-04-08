import { pointToLngLat } from "@/features/planner/lib/map"
import { mobScale } from "@/features/planner/lib/mob-spawns"
import type { MobSpawn } from "@/features/planner/types"
import MapLibreGL from "maplibre-gl"
import { createPortal } from "react-dom"
import { useEffect, useMemo } from "react"
import PlannerMobTooltipContent from "./PlannerMobTooltipContent"

import { useMap } from "../ui/map"

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
      <PlannerMobTooltipContent
        mobSpawn={mobSpawn}
        pullIndex={pullIndex}
        totalEnemyForces={totalEnemyForces}
      />
    </div>,
    container,
  )
}
