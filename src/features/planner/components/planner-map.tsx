import { Suspense, lazy, useEffect, useState } from "react"

const PlannerMapClient = lazy(() =>
  import("./planner-map-client").then((module) => ({ default: module.PlannerMapClient }))
)

export function PlannerMap() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex h-full min-h-[22rem] items-center justify-center bg-background text-xs text-muted-foreground">
        Loading planner surface...
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[22rem] items-center justify-center bg-background text-xs text-muted-foreground">
          Loading planner surface...
        </div>
      }
    >
      <PlannerMapClient />
    </Suspense>
  )
}
