import { createFileRoute } from "@tanstack/react-router"
import { PlannerPage } from "@/features/planner/components/planner-page"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return <PlannerPage />
}
