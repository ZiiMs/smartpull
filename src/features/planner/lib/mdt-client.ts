import type { PlannerRoute } from "@/features/planner/types"

type ExportMdtPayload = {
  route: PlannerRoute
}

type ImportMdtPayload = {
  text: string
}

export function exportMdtRoute(payload: ExportMdtPayload) {
  return fetch("/api/mdt/export", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error("Failed to export MDT route")
    }

    return response.text()
  })
}

export function importMdtRoute(payload: ImportMdtPayload) {
  return fetch("/api/mdt/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error("Failed to import MDT route")
    }

    return response.json() as Promise<PlannerRoute>
  })
}
