import type { PlannerRoute } from "@/features/planner/types"

type ExportMdtPayload = {
  route: PlannerRoute
}

type ImportMdtPayload = {
  text: string
}

async function requestMdt<TResponse>(
  path: string,
  payload: ExportMdtPayload | ImportMdtPayload,
  parseResponse: (response: Response) => Promise<TResponse>,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return parseResponse(response)
}

export function exportMdtRoute(payload: ExportMdtPayload) {
  return requestMdt("/api/mdt/export", payload, (response) => response.text())
}

export function importMdtRoute(payload: ImportMdtPayload) {
  return requestMdt("/api/mdt/import", payload, (response) => response.json() as Promise<PlannerRoute>)
}
