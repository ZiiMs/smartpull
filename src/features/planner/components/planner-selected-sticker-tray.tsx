import { Hand, MousePointerClick, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { warlockGateMaxRange } from "@/features/planner/lib/gates"
import { plannerStickerMeta } from "@/features/planner/lib/stickers"
import type { PlannerStickerKind } from "@/features/planner/types"
import { cn } from "@/lib/utils"

function PlannerSelectedStickerTray({
  stickerKind,
  pendingMove = false,
  className,
  onExit,
}: {
  stickerKind: PlannerStickerKind
  pendingMove?: boolean
  className?: string
  onExit: () => void
}) {
  const meta = plannerStickerMeta[stickerKind]

  return (
    <div
      className={cn(
        "w-64 border border-border/70 bg-card/92 p-3 shadow-2xl backdrop-blur",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex items-start gap-3"
        >
          <div
            className={cn(
              "shrink-0 rounded-full border bg-black/60 p-1 shadow-[0_8px_18px_rgba(0,0,0,0.45)]",
              meta.tone,
            )}
          >
            <img
              src={meta.iconSrc}
              alt={meta.name}
              draggable={false}
              className="size-10 rounded-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {pendingMove ? "Sticker In Hand" : "Selected Sticker"}
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                  meta.tone,
                )}
              >
                {meta.chipLabel}
              </span>
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {meta.name}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {pendingMove
                ? "Click anywhere on the map to place this sticker again."
                : meta.hint}
            </div>
            {stickerKind === "warlockGate" ? (
              <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-violet-200/90">
                Max range {warlockGateMaxRange} yd
              </div>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onExit}
          aria-label={pendingMove ? "Cancel sticker move" : "Exit sticker mode"}
          className="shrink-0"
        >
          <X />
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MousePointerClick className="size-3.5" />
          Click to place
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Hand className="size-3.5" />
          {pendingMove ? "Esc to cancel" : "Shift-drag to move"}
        </span>
      </div>
    </div>
  )
}

export { PlannerSelectedStickerTray }
