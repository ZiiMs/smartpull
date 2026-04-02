export const plannerPullColors = [
  "#ff6b6b",
  "#f59e0b",
  "#facc15",
  "#4ade80",
  "#38bdf8",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
] as const

export function getPullColor(index: number) {
  return plannerPullColors[index % plannerPullColors.length] ?? plannerPullColors[0]
}

