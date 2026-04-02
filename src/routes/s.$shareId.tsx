import { createFileRoute } from "@tanstack/react-router"

import { PlannerPage } from "@/features/planner/components/planner-page"

export const Route = createFileRoute("/s/$shareId")({
  component: SharedRoutePage,
})

function SharedRoutePage() {
  const { shareId } = Route.useParams()
  return <PlannerPage sharedRouteId={shareId} />
}
