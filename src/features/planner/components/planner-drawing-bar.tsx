import { Shapes } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  plannerStickerKinds,
  plannerStickerMeta,
} from "@/features/planner/lib/stickers"
import type { PlannerDrawTool } from "@/features/planner/types"

function PlannerDrawingBar({
  draftPointCount,
  isOpen,
  onOpenChange,
  onSelectTool,
  activeTool,
  compact = false,
  side = "right",
  align = "start",
}: {
  draftPointCount: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelectTool: (tool: PlannerDrawTool) => void
  activeTool: PlannerDrawTool
  compact?: boolean
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}) {
  const activeMeta = plannerStickerMeta[activeTool]

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {compact ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Open drawing tools"
            className="border-border/70"
          >
            <Shapes />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-w-44 justify-between gap-3 border-border/70 bg-card/90 px-3 py-2 text-left shadow-xl backdrop-blur"
          >
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Drawing Bar
              </span>
              <span className="mt-1 block truncate text-sm text-foreground">
                {activeMeta.name}
              </span>
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]",
                activeMeta.tone,
              )}
            >
              {activeMeta.chipLabel}
            </span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={10}
        className="z-[460] w-auto border border-border/70 bg-card/95 p-2 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectTool("line")}
            className={cn(
              "flex h-11 min-w-0 items-center justify-center rounded-md border px-3 transition hover:border-border hover:bg-accent/50",
              activeTool === "line"
                ? "border-amber-300/40 bg-amber-400/10"
                : "border-border/60 bg-background/70",
            )}
            aria-label="Path line"
            title="Path line"
          >
            <span
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]",
                plannerStickerMeta.line.tone,
              )}
            >
              {draftPointCount > 0 ? `${draftPointCount} pts` : "Line"}
            </span>
          </button>

          {plannerStickerKinds.map((kind) => {
            const meta = plannerStickerMeta[kind]
            const selected = activeTool === kind

            return (
              <button
                key={kind}
                type="button"
                onClick={() => onSelectTool(kind)}
                className={cn(
                  "flex size-11 items-center justify-center rounded-md border p-1 transition hover:border-border hover:bg-accent/50",
                  selected
                    ? "border-white/12 bg-background"
                    : "border-border/60 bg-background/70",
                )}
                aria-label={meta.name}
                title={meta.name}
              >
                <img
                  src={meta.iconSrc}
                  alt={meta.name}
                  draggable={false}
                  className="size-8 rounded-full object-cover"
                />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { PlannerDrawingBar }
