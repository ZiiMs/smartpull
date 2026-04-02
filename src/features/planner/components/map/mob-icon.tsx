import { Fragment, memo } from "react"

import type { MobSpawn } from "@/features/planner/types"

const portraitFallbackSrc = "/images/markers/skull.png"
const missingPortraitIds = new globalThis.Set<number>()

function createTextOutline() {
  return "black 1px 0 0, black -1px 0 0, black 0 1px 0, black 0 -1px 0, black 1px 1px 0, black -1px 1px 0, black 1px -1px 0, black -1px -1px 0"
}

function colorWithAlpha(color: string, alpha: number) {
  const normalized = color.replace("#", "")
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((channel) => `${channel}${channel}`)
          .join("")
      : normalized

  const r = Number.parseInt(expanded.slice(0, 2), 16)
  const g = Number.parseInt(expanded.slice(2, 4), 16)
  const b = Number.parseInt(expanded.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatForces(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function createMarkerText(label: string, variant: "forces" | "group") {
  const textScale = Math.min(1, 1.8 / label.length)

  return (
    <div
      className={`planner-mob-marker-text planner-mob-marker-text--${variant}`}
      style={{
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        fontWeight: "700",
        color: "white",
        textShadow: createTextOutline(),
        fontSize: `calc(var(--planner-marker-font-size) * ${textScale})`,
      }}
    >
      {label}
    </div>
  )
}

function createMarkerRing(
  scale = 1,
  borderColor = "var(--border)",
  children?: React.ReactNode,
) {
  const percentSize = 100 * scale
  const diff = (percentSize - 100) / 2
  return (
    <div
      style={{
        position: "absolute",
        top: diff ? `-${diff}%` : "0",
        left: diff ? `-${diff}%` : "0",
        overflow: "hidden",
        borderRadius: "9999px",
        borderStyle: "solid",
        height: `${percentSize}%`,
        width: `${percentSize}%`,
        borderWidth: "var(--planner-marker-border-width)",
        borderColor,
        background: "linear-gradient(to bottom, #dfdfe3, #373738) border-box",
        boxShadow: "black 0px 0px 10px 0px",
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  )
}

export type MobIconMarker = {
  group: number | null
  isSelected: boolean
  markerScale: number
  mobSpawn: MobSpawn
  pullColor?: string
}

export const MobIconMarkup = memo(function MobIconMarkup({
  marker,
}: {
  marker: MobIconMarker
}) {
  const tintColor = marker.pullColor
    ? colorWithAlpha(marker.pullColor, 0.28)
    : "transparent"
  const portraitId = marker.mobSpawn.mob.id
  const portraitSrc = missingPortraitIds.has(portraitId)
    ? portraitFallbackSrc
    : `/npc_portraits/${portraitId}.png`
  const forceLabel = formatForces(marker.mobSpawn.mob.count)
  const groupLabel = marker.group != null ? `G${marker.group}` : null

  return (
    <Fragment>
      {marker.isSelected
        ? createMarkerRing(1.1, marker.pullColor ?? "var(--border)")
        : null}
      {createMarkerRing(
        1,
        marker.pullColor ?? "var(--border)",
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <img
            src={portraitSrc}
            data-mob-portrait-id={portraitId}
            alt=""
            draggable={false}
            onError={(event) => {
              missingPortraitIds.add(portraitId)
              const image = event.currentTarget
              image.onerror = null
              image.src = portraitFallbackSrc
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              backgroundColor: marker.pullColor
                ? colorWithAlpha(marker.pullColor, 0.16)
                : "transparent",
            }}
          />
          {marker.pullColor ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: tintColor,
                pointerEvents: "none",
              }}
            />
          ) : null}
          {createMarkerText(forceLabel, "forces")}
          {groupLabel ? createMarkerText(groupLabel, "group") : null}
        </div>,
      )}
    </Fragment>
  )
})
