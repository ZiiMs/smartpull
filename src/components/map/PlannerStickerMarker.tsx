import { cn } from "@/lib/utils"
import { lngLatToPoint, pointToLngLat } from "@/features/planner/lib/map"
import { plannerStickerMeta } from "@/features/planner/lib/stickers"
import type { PlannerSticker, Point } from "@/features/planner/types"
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from "react"
import { MapMarker, MarkerContent, useMap } from "../ui/map"

const stickerLabelPositionClassNames = {
  none: "hidden",
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
} as const

function PlannerStickerMarker({
  sticker,
  onContextMenu,
  invalid = false,
  onShiftDragMove,
  onShiftDragEnd,
}: {
  sticker: PlannerSticker
  onContextMenu?: (
    event: ReactMouseEvent<HTMLDivElement>,
    position: Point,
  ) => void
  invalid?: boolean
  onShiftDragMove?: (sticker: PlannerSticker, position: Point | null) => void
  onShiftDragEnd?: (sticker: PlannerSticker, position: Point) => void
}) {
  const { map } = useMap()
  const [dragPosition, setDragPosition] = useState<Point | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const markerPosition = dragPosition ?? sticker.position
  const [longitude, latitude] = pointToLngLat(markerPosition)
  const meta = plannerStickerMeta[sticker.kind]
  const showStickerLabel = sticker.kind !== "warlockGate"

  useEffect(() => {
    if (!isDragging) {
      setDragPosition(null)
    }
  }, [isDragging])

  function getPlannerPoint(clientX: number, clientY: number) {
    if (!map) {
      return null
    }

    const bounds = map.getContainer().getBoundingClientRect()
    const point = map.unproject([clientX - bounds.left, clientY - bounds.top])
    return lngLatToPoint(point)
  }

  function handleShiftDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.shiftKey || !onShiftDragEnd || !map) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    map.dragPan.disable()
    setIsDragging(true)
    setDragPosition(sticker.position)

    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextPosition = getPlannerPoint(moveEvent.clientX, moveEvent.clientY)
      if (!nextPosition) {
        return
      }

      setDragPosition(nextPosition)
      onShiftDragMove?.(sticker, nextPosition)
    }

    const finishDrag = (endEvent: PointerEvent) => {
      target.releasePointerCapture(event.pointerId)
      window.removeEventListener("pointermove", handlePointerMove, true)
      window.removeEventListener("pointerup", finishDrag, true)
      window.removeEventListener("pointercancel", finishDrag, true)
      map.dragPan.enable()
      onShiftDragMove?.(sticker, null)

      const nextPosition = getPlannerPoint(endEvent.clientX, endEvent.clientY)
      setIsDragging(false)
      setDragPosition(null)

      if (!nextPosition) {
        return
      }

      onShiftDragEnd(sticker, nextPosition)
    }

    window.addEventListener("pointermove", handlePointerMove, true)
    window.addEventListener("pointerup", finishDrag, true)
    window.addEventListener("pointercancel", finishDrag, true)
  }

  return (
    <MapMarker longitude={longitude} latitude={latitude} anchor="bottom">
      <MarkerContent>
        <div className={cn("group/sticker relative size-9 overflow-visible")}>
          <div
            className={cn(
              "relative size-9 overflow-hidden rounded-full border bg-black/70 p-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.65)] backdrop-blur-[2px]",
              invalid &&
                "border-red-400/85 shadow-[0_0_0_2px_rgba(248,113,113,0.28),0_8px_22px_rgba(127,29,29,0.55)]",
              isDragging ? "cursor-grabbing" : "cursor-pointer",
              "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:content-['']",
              meta.tone,
            )}
            onPointerDown={handleShiftDragStart}
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
          {showStickerLabel ? (
            <div
              className={cn(
                "pointer-events-none absolute",
                stickerLabelPositionClassNames[sticker.labelPosition ?? "right"],
              )}
            >
              <div className="rounded-sm border border-black/45 bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-100 shadow-[0_6px_16px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
                {sticker.text || meta.defaultText || meta.chipLabel}
              </div>
            </div>
          ) : null}
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
