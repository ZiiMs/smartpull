import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  MobSpawn,
  PlannerStickerKind,
  PlannerStickerLabelPosition,
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

const stickerLabelPositionOptions: Array<{
  value: PlannerStickerLabelPosition
  label: string
}> = [
  { value: "none", label: "None" },
  { value: "top", label: "Top" },
  { value: "right", label: "Right" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
]

export function PlannerNoteDialog({
  mobSpawn,
  stickerKind = null,
  initialText = "",
  initialStickerLabelPosition = "right",
  open,
  position,
  onSubmit,
  onOpenChange,
  submitLabel,
  title,
}: {
  mobSpawn: MobSpawn | null
  stickerKind?: PlannerStickerKind | null
  initialText?: string
  initialStickerLabelPosition?: PlannerStickerLabelPosition
  open: boolean
  position: Point | null
  onSubmit: (payload: {
    text: string
    labelPosition: PlannerStickerLabelPosition
  }) => void
  onOpenChange: (open: boolean) => void
  submitLabel?: string
  title?: string
}) {
  const [text, setText] = useState("")
  const [stickerLabelPosition, setStickerLabelPosition] =
    useState<PlannerStickerLabelPosition>("right")
  const stickerMeta = stickerKind ? plannerStickerMeta[stickerKind] : null

  useEffect(() => {
    if (open) {
      setText(initialText)
      setStickerLabelPosition(initialStickerLabelPosition)
    }
  }, [initialStickerLabelPosition, initialText, open])

  const resolvedTitle =
    title ?? (stickerMeta ? `Edit ${stickerMeta.name} Text` : "Add Note")
  const resolvedSubmitLabel =
    submitLabel ?? (stickerMeta ? "Save Sticker Text" : "Add Note")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[950] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>
            {stickerMeta
              ? `Update the text shown for the ${stickerMeta.name.toLowerCase()} marker at the selected map location.`
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
            onSubmit({
              text,
              labelPosition: stickerLabelPosition,
            })
          }}
        >
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoFocus
            rows={5}
            placeholder={
              stickerMeta
                ? `Text for ${stickerMeta.name.toLowerCase()}`
                : mobSpawn
                  ? `Add a note for ${mobSpawn.mob.name}`
                  : "Add a note for this location"
            }
          />

          {stickerMeta ? (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Label Position
              </div>
              <Select
                value={stickerLabelPosition}
                onValueChange={(value) =>
                  setStickerLabelPosition(value as PlannerStickerLabelPosition)
                }
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="Choose label position" />
                </SelectTrigger>
                <SelectContent className="z-[980]">
                  {stickerLabelPositionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {resolvedSubmitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
