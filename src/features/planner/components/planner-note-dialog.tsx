import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type {
  MobSpawn,
  PlannerStickerKind,
  Point,
} from "@/features/planner/types"
import { plannerStickerMeta } from "@/features/planner/lib/stickers"
import { useEffect, useState } from "react"

function formatPositionLabel(position: Point | null) {
  if (!position) {
    return null
  }

  return `${position[0].toFixed(2)}, ${position[1].toFixed(2)}`
}

export function PlannerNoteDialog({
  mobSpawn,
  stickerKind = null,
  open,
  position,
  onCreateNote,
  onOpenChange,
}: {
  mobSpawn: MobSpawn | null
  stickerKind?: PlannerStickerKind | null
  open: boolean
  position: Point | null
  onCreateNote: (text: string) => void
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState("")
  const stickerMeta = stickerKind ? plannerStickerMeta[stickerKind] : null

  useEffect(() => {
    if (open) {
      setText("")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[950] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {stickerMeta ? `Add ${stickerMeta.name} Note` : "Add Note"}
          </DialogTitle>
          <DialogDescription>
            {stickerMeta
              ? `Add text for the ${stickerMeta.name.toLowerCase()} marker at the selected map location.`
              : mobSpawn
                ? `Create a note at ${mobSpawn.mob.name}.`
                : "Create a note at the selected map location."}
            {position ? ` Position: ${formatPositionLabel(position)}.` : null}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            onCreateNote(text)
          }}
        >
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoFocus
            rows={5}
            placeholder={
              stickerMeta
                ? `Add text for ${stickerMeta.name.toLowerCase()}`
                : mobSpawn
                  ? `Add a note for ${mobSpawn.mob.name}`
                  : "Add a note for this location"
            }
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {stickerMeta ? "Add Sticker" : "Add Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
