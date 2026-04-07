import { plannerStickerMeta } from "@/features/planner/lib/stickers"
import type { MobSpawn, PlannerSticker, Point } from "@/features/planner/types"
import type { RefObject } from "react"

export function PlannerMapContextMenu({
  menuRef,
  mobSpawn,
  sticker,
  onAddNote,
  onDeleteSticker,
  onEditSticker,
  onMoveSticker,
  onMobInfo,
  position,
  x,
  y,
}: {
  menuRef: RefObject<HTMLDivElement | null>
  mobSpawn: MobSpawn | null
  sticker: PlannerSticker | null
  onAddNote: () => void
  onDeleteSticker: () => void
  onEditSticker: () => void
  onMoveSticker: () => void
  onMobInfo: () => void
  position: Point
  x: number
  y: number
}) {
  return (
    <div
      ref={menuRef}
      style={{ top: y, left: x }}
      className="fixed z-[920] min-w-52 overflow-hidden border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/20"
    >
      <div className="border-b border-border/70 bg-background/60 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {mobSpawn
            ? "Mob Actions"
            : sticker
              ? "Sticker Actions"
              : "Map Actions"}
        </div>
        <div className="mt-1 text-xs font-medium text-foreground">
          {mobSpawn
            ? mobSpawn.mob.name
            : sticker
              ? plannerStickerMeta[sticker.kind].name
              : `Map point ${position[0].toFixed(2)}, ${position[1].toFixed(2)}`}
        </div>
      </div>

      <button
        type="button"
        onClick={onAddNote}
        className="flex w-full items-center px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
      >
        Add Note
      </button>

      {mobSpawn ? (
        <>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={onMobInfo}
            className="flex w-full items-center px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Mob Info
          </button>
        </>
      ) : null}

      {sticker ? (
        <>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={onEditSticker}
            className="flex w-full items-center px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Edit Sticker Text
          </button>
          <button
            type="button"
            onClick={onMoveSticker}
            className="flex w-full items-center px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Move Sticker
          </button>
          <button
            type="button"
            onClick={onDeleteSticker}
            className="flex w-full items-center px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
          >
            Delete Sticker
          </button>
        </>
      ) : null}
    </div>
  )
}
