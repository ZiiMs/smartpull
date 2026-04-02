import { pointToLngLat } from "@/features/planner/lib/map"
import type { Point } from "@/features/planner/types"
import type { MouseEvent as ReactMouseEvent } from "react"
import { MapMarker, MarkerContent, MarkerTooltip } from "../ui/map"

function PlannerPoiMarker({
  position,
  src,
  description,
  onContextMenu,
}: {
  position: Point
  src: string
  description: string
  onContextMenu?: (
    event: ReactMouseEvent<HTMLDivElement>,
    position: Point,
  ) => void
}) {
  const [longitude, latitude] = pointToLngLat(position)

  return (
    <MapMarker longitude={longitude} latitude={latitude} anchor="center">
      <MarkerContent className="rounded-full">
        <div
          onContextMenu={(event) => {
            if (!onContextMenu) {
              return
            }

            event.preventDefault()
            event.stopPropagation()
            onContextMenu(event, position)
          }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="h-8 w-8 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
          />
        </div>
      </MarkerContent>
      <MarkerTooltip
        offset={18}
        className="border border-border bg-popover  px-3 py-2 text-stone-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-[2px]"
      >
        <div className="min-w-40 space-y-1">
          {[description].filter(Boolean).map((line, index) => (
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
}

export default PlannerPoiMarker
