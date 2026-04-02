import { pointToLngLat } from "@/features/planner/lib/map"
import type { Point } from "@/features/planner/types"
import type { MouseEvent as ReactMouseEvent } from "react"
import { MapMarker, MarkerContent, MarkerTooltip } from "../ui/map"

function PlannerNoteMarker({
  text,
  position,
  onContextMenu,
}: {
  text: string
  position: Point
  onContextMenu?: (
    event: ReactMouseEvent<HTMLDivElement>,
    position: Point,
  ) => void
}) {
  const [longitude, latitude] = pointToLngLat(position)

  return (
    <MapMarker longitude={longitude} latitude={latitude} anchor="center">
      <MarkerContent>
        <div
          className="size-3 rounded-full border border-sky-100/80 bg-sky-500 shadow-[0_0_0_1px_rgba(0,0,0,0.55),0_0_12px_rgba(14,165,233,0.35)]"
          onContextMenu={(event) => {
            if (!onContextMenu) {
              return
            }

            event.preventDefault()
            event.stopPropagation()
            onContextMenu(event, position)
          }}
        />
      </MarkerContent>
      <MarkerTooltip
        offset={12}
        className="border z-50 border-border bg-popover px-3 py-2 text-stone-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-[2px]"
      >
        <div className="min-w-40 z-50 space-y-1">
          {[text].filter(Boolean).map((line, index) => (
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

export default PlannerNoteMarker
