import { cn } from "@/lib/utils"
import { pointToLngLat } from "@/features/planner/lib/map"
import { plannerStickerMeta } from "@/features/planner/lib/stickers"
import type { PlannerSticker, Point } from "@/features/planner/types"
import type { MouseEvent as ReactMouseEvent } from "react"
import { MapMarker, MarkerContent } from "../ui/map"

function PlannerStickerMarker({
  sticker,
  onContextMenu,
  onShiftClick,
}: {
  sticker: PlannerSticker
  onContextMenu?: (
    event: ReactMouseEvent<HTMLDivElement>,
    position: Point,
  ) => void
  onShiftClick?: (sticker: PlannerSticker) => void
}) {
  const [longitude, latitude] = pointToLngLat(sticker.position)
  const meta = plannerStickerMeta[sticker.kind]

  return (
    <MapMarker longitude={longitude} latitude={latitude} anchor="bottom">
      <MarkerContent>
        <div className={cn("group/sticker relative size-9 overflow-visible")}>
          <div
            className={cn(
              "relative size-9 overflow-hidden rounded-full border bg-black/70 p-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.65)] backdrop-blur-[2px]",
              "cursor-pointer",
              "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:content-['']",
              meta.tone,
            )}
            onContextMenu={(event) => {
              if (!onContextMenu) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              onContextMenu(
                event as unknown as ReactMouseEvent<HTMLDivElement>,
                sticker.position,
              )
            }}
            onClick={(event) => {
              if (!event.shiftKey || !onShiftClick) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              onShiftClick(sticker)
            }}
            aria-label={meta.name}
          >
            <div
              className="pointer-events-none absolute inset-[2px] rounded-full bg-center bg-no-repeat bg-cover"
              style={
                meta.iconSrc
                  ? {
                      backgroundImage: `url(${meta.iconSrc})`,
                    }
                  : undefined
              }
            />
          </div>
          <div className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-3 hidden min-w-40 -translate-x-1/2 border border-border bg-popover px-3 py-2 text-stone-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-[2px] group-hover/sticker:block">
            <div className="space-y-1">
              {sticker.text ? (
                <>
                  {sticker.text.split("\n").map((line, index) => (
                    <div
                      key={`${sticker.id}-${index}`}
                      className={
                        index === 0
                          ? "text-[13px] font-semibold tracking-[0.01em] text-amber-100"
                          : "text-[12px] leading-snug text-stone-200/92"
                      }
                    >
                      {line}
                    </div>
                  ))}
                  <div className="pt-0.5 text-[10px] uppercase tracking-[0.2em] text-stone-400/90">
                    {meta.name}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[13px] font-semibold tracking-[0.01em] text-amber-100">
                    {meta.name}
                  </div>
                  <div className="max-w-44 text-[12px] leading-snug text-stone-200/92">
                    {meta.hint}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </MarkerContent>
    </MapMarker>
  )
}

export default PlannerStickerMarker
