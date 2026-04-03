import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  type WowheadSpellDetails,
  getWowheadSpellDetails,
} from "@/features/planner/lib/wowhead-spells-server"
import { getWowheadNpcUrl } from "@/features/planner/lib/wowhead"
import type { MobSpawn, Point } from "@/features/planner/types"
import { cn } from "@/lib/utils"
import { ExternalLink } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

const numberFormatter = new Intl.NumberFormat("en-US")

const characteristicIconMap: Record<string, string> = {
  Stun: "spell_frost_stun",
  Sap: "ability_sap",
  Incapacitate: "ability_monk_paralysis",
  Repentance: "spell_holy_prayerofhealing",
  Disorient: "spell_shadow_mindsteal",
  Banish: "spell_shadow_cripple",
  Fear: "spell_shadow_possession",
  Root: "spell_frost_frostnova",
  Polymorph: "spell_nature_polymorph",
  "Shackle Undead": "spell_nature_slow",
  "Mind Control": "spell_shadow_shadowworddominate",
  Grip: "spell_deathknight_strangulate",
  Knock: "ability_druid_typhoon",
  Silence: "ability_priest_silence",
  Taunt: "spell_nature_reincarnation",
  "Control Undead": "inv_misc_bone_skull_01",
  "Enslave Demon": "spell_shadow_enslavedemon",
  "Subjugate Demon": "spell_shadow_enslavedemon",
  Slow: "ability_rogue_trip",
  Imprison: "ability_demonhunter_imprison",
  "Sleep Walk": "ability_xavius_dreamsimulacrum",
  "Scare Beast": "ability_druid_cower",
  Hibernate: "spell_nature_sleep",
  "Turn Evil": "ability_paladin_turnevil",
  "Mind Soothe": "spell_holy_mindsooth",
}

function getWowIconUrl(iconName: string) {
  return `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg`
}

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function formatForces(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function formatPosition(position: Point) {
  return `${position[0].toFixed(2)}, ${position[1].toFixed(2)}`
}

function formatBoolean(value: boolean | undefined) {
  if (value == null) {
    return "Unknown"
  }

  return value ? "Yes" : "No"
}

function SummaryItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-background/55 px-3 py-2.5">
      <div className="text-[10px] uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">
        {value}
      </div>
    </div>
  )
}

function KvRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-border/40 py-2 last:border-b-0">
      <div className="text-[11px] uppercase text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 break-words text-sm text-foreground">{value}</div>
    </div>
  )
}

function Section({
  title,
  className,
  children,
}: React.ComponentProps<"section"> & { title: string }) {
  return (
    <section
      className={cn("rounded-xl border border-border/60 bg-card/55 p-4", className)}
    >
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function SpellIconCard({
  label,
  spellId,
  spell,
  extraBadges,
  compact = false,
  onSelect,
}: {
  label: string
  spellId: number
  spell: WowheadSpellDetails | null
  extraBadges?: string[]
  compact?: boolean
  onSelect?: (spellId: number) => void
}) {
  const iconUrl = spell?.iconUrl
  const href = spell?.url ?? `https://www.wowhead.com/spell=${spellId}`
  const clickable = typeof onSelect === "function"

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect?.(spellId)}
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/55 text-left transition-colors hover:border-amber-300/35 hover:bg-background/80",
            compact ? "px-2 py-2" : "px-3 py-2.5",
            clickable ? "cursor-pointer" : "cursor-default",
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/20">
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={label}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-[10px] text-muted-foreground">#{spellId}</div>
            )}
          </div>

          {!compact ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {spell?.name ?? label}
              </div>
            </div>
          ) : null}
        </button>
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        className="w-84 rounded-lg border border-border/70 p-3"
      >
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/60">
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={label}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-[10px] text-muted-foreground">#{spellId}</div>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {spell?.name ?? label}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Spell ID {spellId}
              </div>
            </div>

            {spell?.description ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {spell.description}
              </p>
            ) : null}

            {extraBadges?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {extraBadges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-md border border-amber-300/25 bg-amber-400/10 px-1.5 py-0.5 text-[11px] text-amber-100"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}

            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-100 underline underline-offset-4"
            >
              Wowhead
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function CharacteristicCard({ characteristic }: { characteristic: string }) {
  const iconName = characteristicIconMap[characteristic]
  const iconUrl = iconName ? getWowIconUrl(iconName) : null

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/55 px-3 py-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/20">
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={characteristic}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-[10px] text-muted-foreground">CC</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {characteristic}
            </div>
          </div>
        </div>
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        className="w-72 rounded-lg border border-border/70 p-3"
      >
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/60">
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={characteristic}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-[10px] text-muted-foreground">CC</div>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">
              {characteristic}
            </div>
            <div className="text-xs text-muted-foreground">
              MDT susceptibility
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
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
  const [failedPortraitSrc, setFailedPortraitSrc] = useState<string | null>(null)
  const [spellDetailsById, setSpellDetailsById] = useState<
    Record<number, WowheadSpellDetails>
  >({})
  const [selectedSpellId, setSelectedSpellId] = useState<number | null>(null)

  const npcUrl = useMemo(
    () => (mobSpawn ? getWowheadNpcUrl(mobSpawn.mob.id) : ""),
    [mobSpawn],
  )

  const lookupSpellIds = useMemo(() => {
    if (!mobSpawn) {
      return []
    }

    return [...new Set(mobSpawn.mob.spells.map((spell) => spell.id))]
  }, [mobSpawn])

  useEffect(() => {
    if (!open || lookupSpellIds.length === 0) {
      return
    }

    let cancelled = false

    getWowheadSpellDetails({ data: { spellIds: lookupSpellIds } })
      .then((details) => {
        if (cancelled) {
          return
        }

        setSpellDetailsById(
          Object.fromEntries(details.map((detail) => [detail.id, detail])),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setSpellDetailsById({})
        }
      })

    return () => {
      cancelled = true
    }
  }, [lookupSpellIds, open])

  if (!mobSpawn) {
    return null
  }

  const portraitSrc = `/npc_portraits/${mobSpawn.mob.id}.png`
  const portraitMissing = failedPortraitSrc === portraitSrc
  const affectedSpells = mobSpawn.mob.characteristics
  const patrolPoints = mobSpawn.spawn.patrol?.length ?? 0
  const spawnGroup =
    mobSpawn.spawn.group != null ? `Group ${mobSpawn.spawn.group}` : "Ungrouped"
  const selectedSpell =
    selectedSpellId != null ? spellDetailsById[selectedSpellId] ?? null : null
  const selectedSpellAttributes =
    selectedSpellId != null
      ? mobSpawn.mob.spells.find((spell) => spell.id === selectedSpellId)?.attributes ??
        []
      : []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="z-[950] !w-[min(96vw,1600px)] !max-w-[1600px] overflow-hidden p-0">
          <div className="max-h-[90vh] overflow-y-auto bg-popover">
            <div className="border-b border-border/60 bg-card/35 px-7 py-5">
              <DialogHeader>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background/60">
                      {portraitMissing ? (
                        <div className="px-3 text-center text-xs text-muted-foreground">
                          No portrait
                        </div>
                      ) : (
                        <img
                          key={portraitSrc}
                          src={portraitSrc}
                          alt={mobSpawn.mob.name}
                          className="h-full w-full object-contain"
                          onError={() => setFailedPortraitSrc(portraitSrc)}
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <DialogTitle className="text-2xl font-semibold tracking-tight">
                        {mobSpawn.mob.name}
                      </DialogTitle>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>NPC {mobSpawn.mob.id}</span>
                        <span>Enemy #{mobSpawn.mob.enemyIndex}</span>
                        <span>{mobSpawn.mob.isBoss ? "Boss" : "Trash"}</span>
                        <span>{spawnGroup}</span>
                      </div>
                    </div>
                  </div>

                  <a href={npcUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="sm" className="gap-2">
                      Open NPC
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </a>
                </div>
              </DialogHeader>
            </div>

            <div className="space-y-4 px-7 py-5">
              <Section title="Summary">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                  <SummaryItem label="Forces" value={formatForces(mobSpawn.mob.count)} />
                  <SummaryItem label="Health" value={formatNumber(mobSpawn.mob.health)} />
                  <SummaryItem
                    label="Stealth Detect"
                    value={formatBoolean(mobSpawn.mob.stealthDetect)}
                  />
                  <SummaryItem
                    label="Type"
                    value={mobSpawn.mob.creatureType || "Unknown"}
                  />
                  <SummaryItem label="Base Scale" value={`${mobSpawn.mob.scale}`} />
                  <SummaryItem label="Spawns" value={`${mobSpawn.mob.spawns.length}`} />
                  <SummaryItem label="Index" value={`${mobSpawn.spawn.idx}`} />
                  <SummaryItem label="Position" value={formatPosition(mobSpawn.spawn.pos)} />
                </div>
              </Section>

              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Section title="Affected By">
                  {affectedSpells.length > 0 ? (
                    <ScrollArea className="max-h-[22rem]">
                      <div className="grid grid-cols-2 gap-2 pr-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {affectedSpells.map((characteristic) => (
                          <CharacteristicCard
                            key={characteristic}
                            characteristic={characteristic}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <EmptyState>No effect data.</EmptyState>
                  )}
                </Section>

                <Section title="Casted Spells">
                  {mobSpawn.mob.spells.length > 0 ? (
                    <ScrollArea className="max-h-[22rem]">
                      <div className="grid grid-cols-1 gap-2 pr-4 md:grid-cols-2 xl:grid-cols-3">
                        {mobSpawn.mob.spells.map((spell) => (
                          <SpellIconCard
                            key={`${mobSpawn.mob.id}-${spell.id}`}
                            label={spellDetailsById[spell.id]?.name ?? `Spell ${spell.id}`}
                            spellId={spell.id}
                            spell={spellDetailsById[spell.id] ?? null}
                            extraBadges={spell.attributes.filter(Boolean)}
                            onSelect={setSelectedSpellId}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <EmptyState>No spell data.</EmptyState>
                  )}
                </Section>
              </div>

              <Section title="Spawn">
                <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
                  <div>
                    <KvRow label="Spawn ID" value={mobSpawn.spawn.id} />
                    <KvRow label="Spawn Index" value={`${mobSpawn.spawn.idx}`} />
                    <KvRow label="Group" value={spawnGroup} />
                  </div>
                  <div>
                    <KvRow
                      label="Scale"
                      value={
                        mobSpawn.spawn.scale != null
                          ? `${mobSpawn.spawn.scale}`
                          : "Uses mob scale"
                      }
                    />
                    <KvRow label="Position" value={formatPosition(mobSpawn.spawn.pos)} />
                    <KvRow label="Patrol Points" value={`${patrolPoints}`} />
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedSpellId != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedSpellId(null)
          }
        }}
      >
        <DialogContent className="z-[960] !w-[min(92vw,720px)] !max-w-[720px] p-0">
          <div className="bg-popover">
            <div className="border-b border-border/60 px-5 py-4">
              <DialogHeader className="gap-3">
                <div className="flex gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/60">
                    {selectedSpell?.iconUrl ? (
                      <img
                        src={selectedSpell.iconUrl}
                        alt={selectedSpell.name}
                        className="h-full w-full object-cover"
                      />
                    ) : selectedSpellId != null ? (
                      <div className="text-[10px] text-muted-foreground">
                        #{selectedSpellId}
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-semibold">
                      {selectedSpell?.name ??
                        (selectedSpellId != null
                          ? `Spell ${selectedSpellId}`
                          : "Spell")}
                    </DialogTitle>
                    {selectedSpellId != null ? (
                      <DialogDescription>Spell ID {selectedSpellId}</DialogDescription>
                    ) : null}
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="space-y-4 px-5 py-4">
              {selectedSpell?.description ? (
                <div className="space-y-3 rounded-lg border border-border/60 bg-background/55 px-4 py-3">
                  {selectedSpell.details.length > 0 ? (
                    <div className="space-y-1 text-sm text-foreground">
                      {selectedSpell.details.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  ) : null}

                  <div className="text-sm leading-relaxed text-foreground">
                    {selectedSpell.description}
                  </div>
                </div>
              ) : selectedSpell?.details.length ? (
                <div className="rounded-lg border border-border/60 bg-background/55 px-4 py-3">
                  <div className="space-y-1 text-sm text-foreground">
                    {selectedSpell.details.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState>No description available.</EmptyState>
              )}

              {selectedSpellAttributes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedSpellAttributes.map((attribute) => (
                    <span
                      key={attribute}
                      className="rounded-md border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-xs text-amber-100"
                    >
                      {attribute}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <DialogFooter className="border-t border-border/60 px-5 py-4">
              {selectedSpellId != null ? (
                <a
                  href={
                    selectedSpell?.url ??
                    `https://www.wowhead.com/spell=${selectedSpellId}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="secondary" className="gap-2">
                    Open on Wowhead
                    <ExternalLink className="size-3.5" />
                  </Button>
                </a>
              ) : null}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
