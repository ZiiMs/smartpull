import type { PlannerRoute } from "@/features/planner/types"
import {
  exportMdtRoute as exportMdtRouteServer,
  importMdtRoute as importMdtRouteServer,
} from "@/features/planner/lib/mdt-server"

type ExportMdtPayload = {
  route: PlannerRoute
}

type ImportMdtPayload = {
  text: string
}

export function exportMdtRoute(payload: ExportMdtPayload) {
  return exportMdtRouteServer({ data: payload })
}

export function importMdtRoute(payload: ImportMdtPayload) {
  return importMdtRouteServer({ data: payload })
}
