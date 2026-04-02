import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getWowheadNpcEmbedUrl,
  getWowheadNpcUrl,
  getWowheadSpellUrl,
} from "@/features/planner/lib/wowhead"
import type { MobSpawn } from "@/features/planner/types"
import { cn } from "@/lib/utils"
import { ExternalLink, Sparkles } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"

const numberFormatter = new Intl.NumberFormat("en-US")

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function formatForces(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function DetailCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "emphasis"
}) {
  return (
    <div
      className={cn(
        "border border-border/60 bg-background/80 px-3 py-3",
        tone === "emphasis" ? "bg-amber-500/8" : null,
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function Chip({
  children,
  tone = "default",
}: {
  children: ReactNode
  tone?: "default" | "accent"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-1 text-[11px] font-medium tracking-[0.01em]",
        tone === "accent"
          ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
          : "border-border/60 bg-background/80 text-foreground/90",
      )}
    >
      {children}
    </span>
  )
}

export function PlannerMobInfoDialog({
  mobSpawn,
  onOpenChange,
  open,
}: {
  mobSpawn: MobSpawn | null
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [previewState, setPreviewState] = useState<
    "loading" | "ready" | "fallback"
  >("loading")

  useEffect(() => {
    if (!open || !mobSpawn) {
      return
    }

    setPreviewState("loading")
    const timeoutId = window.setTimeout(() => {
      setPreviewState((current) =>
        current === "loading" ? "fallback" : current,
      )
    }, 1800)

    return () => window.clearTimeout(timeoutId)
  }, [mobSpawn, open])

  const npcUrl = useMemo(
    () => (mobSpawn ? getWowheadNpcUrl(mobSpawn.mob.id) : ""),
    [mobSpawn],
  )
  const embedUrl = useMemo(
    () => (mobSpawn ? getWowheadNpcEmbedUrl(mobSpawn.mob.id) : ""),
    [mobSpawn],
  )

  if (!mobSpawn) {
    return null
  }

  const portraitSrc = `/npc_portraits/${mobSpawn.mob.id}.png`
  const ccCharacteristics = mobSpawn.mob.characteristics ?? []
  const spells = mobSpawn.mob.spells ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[950] w-[min(96vw,1200px)] max-w-[1200px] overflow-hidden p-0">
        <div className="grid max-h-[88vh] grid-cols-1 bg-popover text-popover-foreground lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section className="relative min-h-[20rem] overflow-hidden border-b border-border/60 bg-[#090d14] lg:min-h-[42rem] lg:border-r lg:border-b-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#0f1724_0%,#090d14_100%)]" />

            {previewState !== "fallback" ? (
              <iframe
                title={`${mobSpawn.mob.name} preview`}
                src={embedUrl}
                className={cn(
                  "absolute inset-0 h-full w-full border-0 transition-opacity duration-300",
                  previewState === "ready"
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none",
                )}
                onLoad={() => setPreviewState("ready")}
              />
            ) : null}

            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 transition-opacity duration-300",
                previewState === "ready"
                  ? "opacity-0 pointer-events-none"
                  : "opacity-100",
              )}
            >
              <div className="relative flex h-[16rem] w-[16rem] items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:h-[18rem] sm:w-[18rem]">
                <div className="absolute inset-4 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.22),transparent_58%)]" />
                <img
                  src={portraitSrc}
                  alt={mobSpawn.mob.name}
                  className="relative h-[88%] w-[88%] object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)]"
                />
              </div>

              <div className="max-w-xl space-y-2 text-center">
                <div className="inline-flex items-center gap-2 border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-100/90">
                  <Sparkles className="size-3.5" />
                  {previewState === "loading"
                    ? "Loading Wowhead preview"
                    : "Preview fallback"}
                </div>
                <p className="text-sm text-stone-200/92">
                  {previewState === "loading"
                    ? "Trying to load a Wowhead preview for this NPC. If that does not render, the local portrait stays available here."
                    : "Wowhead preview is not available in this modal, so the local NPC portrait is shown instead."}
                </p>
              </div>
            </div>

            <div className="absolute right-4 bottom-4 left-4 flex flex-wrap items-center gap-2">
              <a href={npcUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm" className="gap-2">
                  Open on Wowhead
                  <ExternalLink className="size-3.5" />
                </Button>
              </a>
              <div className="text-[11px] text-stone-300/75">
                NPC ID {mobSpawn.mob.id}
              </div>
            </div>
          </section>

          <section className="overflow-y-auto">
            <div className="space-y-6 p-6 sm:p-7">
              <DialogHeader className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Mob Info
                </div>
                <DialogTitle className="text-2xl font-semibold tracking-tight">
                  {mobSpawn.mob.name}
                </DialogTitle>
                <DialogDescription className="max-w-xl">
                  Local MDT data for this NPC, with direct links out to Wowhead
                  for spell lookups.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <DetailCard
                  label="Health (+2)"
                  value={formatNumber(mobSpawn.mob.health)}
                  tone="emphasis"
                />
                <DetailCard
                  label="Enemy Forces"
                  value={formatForces(mobSpawn.mob.count)}
                />
                <DetailCard label="Stealthed" value="Unknown" />
                <DetailCard
                  label="Detects Stealth"
                  value={mobSpawn.mob.stealthDetect ? "Yes" : "No"}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DetailCard
                  label="Creature Type"
                  value={mobSpawn.mob.creatureType || "Unknown"}
                />
                <DetailCard
                  label="Encounter Role"
                  value={mobSpawn.mob.isBoss ? "Boss" : "Trash"}
                />
                <DetailCard
                  label="Spawn Group"
                  value={
                    mobSpawn.spawn.group != null
                      ? `Group ${mobSpawn.spawn.group}`
                      : "Ungrouped"
                  }
                />
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Affected By CC</h3>
                  <p className="text-xs text-muted-foreground">
                    Crowd control categories exposed by the local MDT dataset.
                  </p>
                </div>
                {ccCharacteristics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {ccCharacteristics.map((characteristic) => (
                      <Chip key={characteristic}>{characteristic}</Chip>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
                    No crowd-control characteristics were provided for this mob.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Spells</h3>
                  <p className="text-xs text-muted-foreground">
                    Spell names are not present in the local MDT data, so each
                    entry links out by spell ID.
                  </p>
                </div>

                {spells.length > 0 ? (
                  <div className="space-y-2">
                    {spells.map((spell) => {
                      const spellUrl = getWowheadSpellUrl(spell.id)

                      return (
                        <div
                          key={`${mobSpawn.mob.id}-${spell.id}`}
                          className="flex flex-col gap-3 border border-border/60 bg-background/80 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="space-y-2">
                            <a
                              href={spellUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground underline decoration-border underline-offset-4 hover:text-amber-200"
                            >
                              Spell {spell.id}
                              <ExternalLink className="size-3.5" />
                            </a>
                            <div className="text-xs text-muted-foreground">
                              Spell ID {spell.id}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 sm:max-w-[16rem] sm:justify-end">
                            {spell.attributes.length > 0 ? (
                              spell.attributes.map((attribute) => (
                                <Chip
                                  key={`${spell.id}-${attribute}`}
                                  tone="accent"
                                >
                                  {attribute}
                                </Chip>
                              ))
                            ) : (
                              <Chip>No attributes</Chip>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
                    No spell data was attached to this mob in the local MDT
                    payload.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
