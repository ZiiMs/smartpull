import aa from "@/features/planner/data/mdt/aa.json"
import cavns from "@/features/planner/data/mdt/cavns.json"
import magi from "@/features/planner/data/mdt/magi.json"
import pit from "@/features/planner/data/mdt/pit.json"
import seat from "@/features/planner/data/mdt/seat.json"
import sky from "@/features/planner/data/mdt/sky.json"
import wind from "@/features/planner/data/mdt/wind.json"
import xenas from "@/features/planner/data/mdt/xenas.json"
import { mdtEnemiesToMobSpawns } from "@/features/planner/lib/mob-spawns"
import type { DungeonDefinition, DungeonKey, MdtDungeon } from "@/features/planner/types"

const dungeonData: Record<DungeonKey, Omit<DungeonDefinition, "mobSpawns" | "mobSpawnsList">> = {
  aa: {
    key: "aa",
    name: "Algeth'ar Academy",
    shortName: "AA",
    icon: "achievement_dungeon_dragonacademy",
    mapPalette: ["#1f4d4f", "#0f172a"],
    mdt: aa as unknown as MdtDungeon,
  },
  cavns: {
    key: "cavns",
    name: "Maisara Caverns",
    shortName: "CAVNS",
    icon: "inv_achievement_dungeon_maisarahills",
    mapPalette: ["#6c4c7c", "#111827"],
    mdt: cavns as unknown as MdtDungeon,
  },
  magi: {
    key: "magi",
    name: "Magisters' Terrace",
    shortName: "MAGI",
    icon: "inv_achievement_dungeon_magistersterrace",
    mapPalette: ["#7c4d19", "#1f2937"],
    mdt: magi as unknown as MdtDungeon,
  },
  pit: {
    key: "pit",
    name: "Pit of Saron",
    shortName: "PIT",
    icon: "achievement_dungeon_icecrown_pitofsaron",
    mapPalette: ["#295377", "#0b1120"],
    mdt: pit as unknown as MdtDungeon,
  },
  seat: {
    key: "seat",
    name: "Seat of the Triumvirate",
    shortName: "SEAT",
    icon: "achievement_dungeon_argusdungeon",
    mapPalette: ["#204a68", "#111827"],
    mdt: seat as unknown as MdtDungeon,
  },
  sky: {
    key: "sky",
    name: "Skyreach",
    shortName: "SKY",
    icon: "achievement_dungeon_arakkoaspires",
    mapPalette: ["#7a5f31", "#172033"],
    mdt: sky as unknown as MdtDungeon,
  },
  wind: {
    key: "wind",
    name: "Windrunner Spire",
    shortName: "WIND",
    icon: "inv_achievement_dungeon_windrunnerspire",
    mapPalette: ["#35596f", "#111827"],
    mdt: wind as unknown as MdtDungeon,
  },
  xenas: {
    key: "xenas",
    name: "Nexus-Point Xenas",
    shortName: "XENAS",
    icon: "inv_achievement_dungeon_nexuspointxenas",
    mapPalette: ["#32505d", "#0f172a"],
    mdt: xenas as unknown as MdtDungeon,
  },
}

export const seasonLabel = "Midnight Season 1"

export const dungeons = Object.values(dungeonData)
  .map<DungeonDefinition>((dungeon) => {
    const mobSpawns = mdtEnemiesToMobSpawns(dungeon.mdt.enemies)
    return {
      ...dungeon,
      mobSpawns,
      mobSpawnsList: Object.values(mobSpawns),
    }
  })
  .sort((left, right) => left.name.localeCompare(right.name))

export const dungeonsByKey = Object.fromEntries(
  dungeons.map((dungeon) => [dungeon.key, dungeon]),
) as Record<DungeonKey, DungeonDefinition>

export const dungeonsByMdtIndex = Object.fromEntries(
  dungeons.map((dungeon) => [dungeon.mdt.dungeonIndex, dungeon]),
) as Record<number, DungeonDefinition>
