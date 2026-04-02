import type { MobSpawn, Point } from "@/features/planner/types"
import type { RefObject } from "react"

export function PlannerMapContextMenu({
  menuRef,
  mobSpawn,
  onAddNote,
  onMobInfo,
  position,
  x,
  y,
}: {
  menuRef: RefObject<HTMLDivElement | null>
  mobSpawn: MobSpawn | null
  onAddNote: () => void
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
          {mobSpawn ? "Mob Actions" : "Map Actions"}
        </div>
        <div className="mt-1 text-xs font-medium text-foreground">
          {mobSpawn
            ? mobSpawn.mob.name
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
    </div>
  )
}
