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
import type { MobSpawn, Point } from "@/features/planner/types"
import { useEffect, useState } from "react"

function formatPositionLabel(position: Point | null) {
  if (!position) {
    return null
  }

  return `${position[0].toFixed(2)}, ${position[1].toFixed(2)}`
}

export function PlannerNoteDialog({
  mobSpawn,
  open,
  position,
  onCreateNote,
  onOpenChange,
}: {
  mobSpawn: MobSpawn | null
  open: boolean
  position: Point | null
  onCreateNote: (text: string) => void
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState("")

  useEffect(() => {
    if (open) {
      setText("")
    }
  }, [open, position, mobSpawn?.spawn.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[950] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            {mobSpawn
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
              mobSpawn
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
            <Button type="submit">Add Note</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
