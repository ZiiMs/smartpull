import type {
  PlannerDrawTool,
  PlannerStickerKind,
} from "@/features/planner/types"

export const plannerStickerMeta: Record<
  PlannerDrawTool,
  {
    chipLabel: string
    defaultText?: string
    name: string
    hint: string
    tone: string
    iconSrc?: string
  }
> = {
  line: {
    chipLabel: "Line",
    name: "Path line",
    hint: "Click to place points, then finish the draft.",
    tone: "border-amber-300/40 bg-amber-400/12 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]",
  },
  bloodlust: {
    chipLabel: "Lust",
    defaultText: "Lust",
    name: "Bloodlust",
    hint: "Drop a marker for heroism, lust, or time warp.",
    tone: "border-rose-300/40 bg-rose-500/14 text-rose-50 shadow-[0_0_0_1px_rgba(244,63,94,0.16)]",
    iconSrc:
      "https://wow.zamimg.com/images/wow/icons/large/spell_nature_bloodlust.jpg",
  },
  warlockGate: {
    chipLabel: "Gate",
    defaultText: "Gate",
    name: "Warlock gate",
    hint: "Mark gateway endpoints and keep the pair within 40 yd.",
    tone: "border-violet-300/40 bg-violet-500/14 text-violet-50 shadow-[0_0_0_1px_rgba(139,92,246,0.18)]",
    iconSrc:
      "https://wow.zamimg.com/images/wow/icons/large/spell_warlock_demonicportal_purple.jpg",
  },
  stealth: {
    chipLabel: "Stealth",
    defaultText: "Stealth",
    name: "Stealth",
    hint: "Mark shroud skips or stealth setup spots.",
    tone: "border-emerald-300/40 bg-emerald-500/14 text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]",
    iconSrc:
      "https://wow.zamimg.com/images/wow/icons/large/ability_stealth.jpg",
  },
}

export const plannerStickerKinds = [
  "bloodlust",
  "warlockGate",
  "stealth",
] as const satisfies readonly PlannerStickerKind[]
