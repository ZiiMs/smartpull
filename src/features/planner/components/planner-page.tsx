import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Clipboard,
  Copy,
  Eraser,
  GripVertical,
  Link2,
  LoaderCircle,
  PencilLine,
  Plus,
  Redo2,
  Route,
  Shapes,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { type ComponentProps, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PlannerMap } from "@/features/planner/components/planner-map"
import { dungeons } from "@/features/planner/data/dungeons"
import { plannerSampleRoutes } from "@/features/planner/data/sample-routes"
import {
  exportMdtRoute,
  importMdtRoute,
} from "@/features/planner/lib/mdt-server"
import {
  countForSpawns,
  summarizeSpawnsByMob,
} from "@/features/planner/lib/mob-spawns"
import { getPullColor } from "@/features/planner/lib/pull-colors"
import { decodeSharedRoute } from "@/features/planner/lib/share-codec"
import {
  createSharedRoute,
  getSharedRoute,
} from "@/features/planner/lib/share-server"
import {
  getImportableTopRoutes,
  type ImportableTopRoute,
} from "@/features/planner/lib/top-routes-server"
import {
  selectActiveDungeon,
  selectActiveRoute,
  selectDraftDrawing,
  selectDungeonKey,
  selectMode,
  selectSelectedPullId,
  usePlannerStore,
} from "@/features/planner/store/planner-store"
import type { PlannerPull } from "@/features/planner/types"

type DialogMode = null | "import" | "rename"

type PullContextMenuState = {
  pullId: string
  x: number
  y: number
} | null

type PullSummary = {
  id: string
  cumulativeForces: number
  forces: number
  mobSummary: ReturnType<typeof summarizeSpawnsByMob>
}

type RouteLibraryOption =
  | {
      id: string
      kind: "sample"
      label: string
      detail: string
    }
  | {
      id: string
      kind: "top-run"
      label: string
      detail: string
      badge: string
      team: Array<{
        name: string
        className: string | null
      }>
      mdt: string
    }

const wowClassColors: Record<string, string> = {
  "Death Knight": "#C41E3A",
  "Demon Hunter": "#A330C9",
  Druid: "#FF7C0A",
  Evoker: "#33937F",
  Hunter: "#AAD372",
  Mage: "#3FC7EB",
  Monk: "#00FF98",
  Paladin: "#F48CBA",
  Priest: "#FFFFFF",
  Rogue: "#FFF468",
  Shaman: "#0070DD",
  Warlock: "#8788EE",
  Warrior: "#C69B6D",
}

function getClassColor(className: string | null) {
  if (!className) {
    return undefined
  }

  return wowClassColors[className]
}

function getRoleOrder(role: string | null) {
  switch (role?.toLowerCase()) {
    case "tank":
      return 0
    case "healer":
      return 1
    case "dps":
      return 2
    default:
      return 3
  }
}

type ToolbarActionButtonProps = ComponentProps<typeof Button> & {
  tooltip: string
}

function ToolbarActionButton({
  tooltip,
  children,
  ...props
}: ToolbarActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon-sm" variant="outline" {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={3}
        className="z-[700] rounded-md border border-border/70 bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-xl shadow-black/10 [&>svg]:hidden"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

type SortablePullItemProps = {
  pull: PlannerPull
  index: number
  pullSummary: PullSummary
  isActive: boolean
  onSelect: (pullId: string) => void
  onOpenContextMenu: (
    event: ReactMouseEvent<HTMLButtonElement>,
    pullId: string,
  ) => void
  formatEnemyForces: (value: number) => string
}

function SortablePullItem({
  pull,
  index,
  pullSummary,
  isActive,
  onSelect,
  onOpenContextMenu,
  formatEnemyForces,
}: SortablePullItemProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pull.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  }
  const dragListeners = listeners
    ? {
        ...listeners,
        onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
          if (event.button !== 0) {
            return
          }

          listeners.onPointerDown?.(event)
        },
      }
    : undefined

  return (
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={`relative border transition-colors ${
            isActive
              ? "border-primary bg-primary/8"
              : "border-border/60 bg-background hover:border-primary/40"
          } ${isDragging ? "z-10 opacity-60 shadow-xl" : ""}`}
        >
          <button
            ref={setActivatorNodeRef}
            type="button"
            onClick={() => onSelect(pull.id)}
            onContextMenu={(event) => onOpenContextMenu(event, pull.id)}
            className="relative block w-full touch-none px-3 py-2 text-left text-xs cursor-grab active:cursor-grabbing"
            {...attributes}
            {...dragListeners}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getPullColor(index) }}
                  />
                  <span className="truncate">
                    {pull.label || `Pull ${index + 1}`}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {pull.spawns.length} spawns assigned
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-foreground">
                  {formatEnemyForces(pullSummary.forces)}
                </div>
                <GripVertical
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </div>
            </div>
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={8}
        className="z-[700] max-w-80 border border-border bg-card px-3 py-2 text-foreground shadow-2xl ring-1 ring-black/20 [&>svg]:hidden"
      >
        <div className="space-y-1.5">
          <div className="font-medium">
            {pull.label || `Pull ${index + 1}`}
          </div>
          <div className="space-y-0.5 text-muted-foreground">
            <div>Pull Forces: {formatEnemyForces(pullSummary.forces)}</div>
            <div>
              Route Total: {formatEnemyForces(pullSummary.cumulativeForces)}
            </div>
            <div>Mob Count: {pull.spawns.length}</div>
          </div>
          {pullSummary.mobSummary.length > 0 ? (
            pullSummary.mobSummary.map((mob) => (
              <div key={mob.id} className="leading-tight text-foreground">
                {mob.count}x {mob.name}
              </div>
            ))
          ) : (
            <div className="text-muted-foreground">No mobs in this pull.</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function PlannerPage({ sharedRouteId = null }: { sharedRouteId?: string | null } = {}) {
  const navigate = useNavigate()
  const hydrated = usePlannerStore((state) => state.hydrated)
  const hydrate = usePlannerStore((state) => state.hydrate)
  const undo = usePlannerStore((state) => state.undo)
  const redo = usePlannerStore((state) => state.redo)
  const createRoute = usePlannerStore((state) => state.createRoute)
  const duplicateActiveRoute = usePlannerStore(
    (state) => state.duplicateActiveRoute,
  )
  const deleteActiveRoute = usePlannerStore((state) => state.deleteActiveRoute)
  const renameActiveRoute = usePlannerStore((state) => state.renameActiveRoute)
  const clearActiveRoute = usePlannerStore((state) => state.clearActiveRoute)
  const setDungeon = usePlannerStore((state) => state.setDungeon)
  const selectRoute = usePlannerStore((state) => state.selectRoute)
  const selectPull = usePlannerStore((state) => state.selectPull)
  const selectPullRelative = usePlannerStore(
    (state) => state.selectPullRelative,
  )
  const addPull = usePlannerStore((state) => state.addPull)
  const appendPull = usePlannerStore((state) => state.appendPull)
  const prependPull = usePlannerStore((state) => state.prependPull)
  const clearSelectedPull = usePlannerStore((state) => state.clearSelectedPull)
  const deleteSelectedPull = usePlannerStore(
    (state) => state.deleteSelectedPull,
  )
  const reorderPull = usePlannerStore((state) => state.reorderPull)
  const setMode = usePlannerStore((state) => state.setMode)
  const updateNote = usePlannerStore((state) => state.updateNote)
  const deleteNote = usePlannerStore((state) => state.deleteNote)
  const commitDraftDrawing = usePlannerStore(
    (state) => state.commitDraftDrawing,
  )
  const cancelDraftDrawing = usePlannerStore(
    (state) => state.cancelDraftDrawing,
  )
  const importSharedRoute = usePlannerStore((state) => state.importSharedRoute)
  const setActiveRouteShareId = usePlannerStore((state) => state.setActiveRouteShareId)
  const dungeon = usePlannerStore((state) => selectActiveDungeon(state.present))
  const route = usePlannerStore((state) => selectActiveRoute(state.present))
  const routes = usePlannerStore((state) => state.present.routes)
  const dungeonKey = usePlannerStore((state) => selectDungeonKey(state.present))
  const mode = usePlannerStore((state) => selectMode(state.present))
  const draftDrawing = usePlannerStore((state) =>
    selectDraftDrawing(state.present),
  )
  const selectedPullId = usePlannerStore((state) =>
    selectSelectedPullId(state.present),
  )
  const routeOptions = useMemo(
    () => routes.filter((item) => item.dungeonKey === dungeonKey),
    [dungeonKey, routes],
  )
  const sampleRoutes = plannerSampleRoutes[dungeonKey] ?? []
  const pullSummaries = useMemo(() => {
    if (!route) {
      return []
    }

    let runningForces = 0

    return route.pulls.map((pull) => {
      const forces = countForSpawns(pull.spawns, dungeon.mobSpawns)
      runningForces += forces

      return {
        id: pull.id,
        cumulativeForces: runningForces,
        forces,
        mobSummary: summarizeSpawnsByMob(pull.spawns, dungeon.mobSpawns),
      }
    })
  }, [dungeon.mobSpawns, route])
  const totalCount = route
    ? route.pulls.reduce(
        (sum, pull) => sum + countForSpawns(pull.spawns, dungeon.mobSpawns),
        0,
      )
    : 0

  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [routeName, setRouteName] = useState("")
  const [importValue, setImportValue] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [loadingRouteLibraryId, setLoadingRouteLibraryId] = useState<
    string | null
  >(null)
  const [topRuns, setTopRuns] = useState<ImportableTopRoute[]>([])
  const [topRunsState, setTopRunsState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle")
  const [pullContextMenu, setPullContextMenu] = useState<PullContextMenuState>(
    null,
  )
  const pullContextMenuRef = useRef<HTMLDivElement | null>(null)
  const routeLibraryOptions = useMemo<RouteLibraryOption[]>(
    () => [
      ...sampleRoutes.map((sampleRoute) => ({
        id: sampleRoute.id,
        kind: "sample" as const,
        label: sampleRoute.name,
        detail: sampleRoute.source,
      })),
      ...topRuns.map((topRun) => {
        const tankName =
          topRun.team.find((member) => member.role === "tank")?.name ??
          topRun.team[0]?.name ??
          "Unknown"

        return {
          id: `top-run-${topRun.runId}`,
          kind: "top-run" as const,
          label: `${tankName} +${topRun.mythicLevel}`,
          detail: `${topRun.score.toFixed(1)} score • ${topRun.dungeonName}`,
          badge: `Rank ${topRun.rank}`,
          team: [...topRun.team]
            .sort((left, right) => {
              const roleDelta =
                getRoleOrder(left.role) - getRoleOrder(right.role)
              if (roleDelta !== 0) {
                return roleDelta
              }

              return left.name.localeCompare(right.name)
            })
            .map((member) => ({
              name: member.name,
              className: member.className,
            })),
          mdt: topRun.mdt,
        }
      }),
    ],
    [sampleRoutes, topRuns],
  )
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function formatEnemyForces(value: number) {
    const percent = (value / dungeon.mdt.totalCount) * 100
    const formattedPercent = Number.isInteger(percent)
      ? percent.toFixed(0)
      : percent.toFixed(1)
    return `${value} / ${dungeon.mdt.totalCount} (${formattedPercent}%)`
  }

  function getDungeonIconUrl(icon: string) {
    return `https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`
  }

  function handleDragStart(event: DragStartEvent) {
    const pullId = String(event.active.id)
    selectPull(pullId)
  }

  function handleDragEnd(event: DragEndEvent) {
    const sourcePullId = String(event.active.id)
    const targetPullId = event.over ? String(event.over.id) : null

    if (!targetPullId || sourcePullId === targetPullId) {
      return
    }

    const targetIndex = route.pulls.findIndex(
      (pull) => pull.id === targetPullId,
    )
    if (targetIndex < 0) {
      return
    }

    reorderPull(sourcePullId, targetIndex)
  }

  function runPullAction(pullId: string, action: () => void) {
    selectPull(pullId)
    action()
  }

  function handleInsertPullBefore(pullId: string) {
    runPullAction(pullId, prependPull)
  }

  function handleInsertPullAfter(pullId: string) {
    runPullAction(pullId, appendPull)
  }

  function handleClearPull(pullId: string) {
    runPullAction(pullId, clearSelectedPull)
  }

  function handleDeletePull(pullId: string) {
    runPullAction(pullId, () => deleteSelectedPull())
  }

  function closePullContextMenu() {
    setPullContextMenu(null)
  }

  function handleOpenPullContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    pullId: string,
  ) {
    event.preventDefault()
    event.stopPropagation()
    selectPull(pullId)
    setPullContextMenu({
      pullId,
      x: event.clientX + 4,
      y: event.clientY + 4,
    })
  }

  function handleContextInsertBefore() {
    if (!pullContextMenu) {
      return
    }

    handleInsertPullBefore(pullContextMenu.pullId)
    closePullContextMenu()
  }

  function handleContextInsertAfter() {
    if (!pullContextMenu) {
      return
    }

    handleInsertPullAfter(pullContextMenu.pullId)
    closePullContextMenu()
  }

  function handleContextClearPull() {
    if (!pullContextMenu) {
      return
    }

    handleClearPull(pullContextMenu.pullId)
    closePullContextMenu()
  }

  function handleContextDeletePull() {
    if (!pullContextMenu) {
      return
    }

    handleDeletePull(pullContextMenu.pullId)
    closePullContextMenu()
  }

  function handleContextClearRoute() {
    clearActiveRoute()
    closePullContextMenu()
  }

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!hydrated || !sharedRouteId) {
      return
    }

    let cancelled = false

    void getSharedRoute({ data: { shareId: sharedRouteId } })
      .then((sharedRoute) => {
        if (cancelled) {
          return
        }

        importSharedRoute(sharedRoute)
        setStatusMessage("Imported shared route from share link.")
        void navigate({ to: "/", replace: true })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setStatusMessage("Could not load that shared route.")
      })

    return () => {
      cancelled = true
    }
  }, [hydrated, importSharedRoute, navigate, sharedRouteId])

  useEffect(() => {
    if (!hydrated || sharedRouteId || typeof window === "undefined") {
      return
    }

    const payload = new URL(window.location.href).searchParams.get("route")
    if (!payload) {
      return
    }

    try {
      importSharedRoute(decodeSharedRoute(payload))
      setStatusMessage("Imported shared route from URL.")
      void navigate({ to: "/", replace: true })
    } catch {
      setStatusMessage("Could not decode the shared route URL.")
    }
  }, [hydrated, importSharedRoute, navigate, sharedRouteId])

  useEffect(() => {
    setRouteName(route?.name ?? "")
  }, [route?.name])

  useEffect(() => {
    let cancelled = false

    setTopRunsState("loading")

    void getImportableTopRoutes({ data: { dungeonKey } })
      .then((runs) => {
        if (cancelled) {
          return
        }

        setTopRuns(runs)
        setTopRunsState("ready")
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setTopRuns([])
        setTopRunsState("error")
      })

    return () => {
      cancelled = true
    }
  }, [dungeonKey])

  useEffect(() => {
    if (!pullContextMenu) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Node &&
        pullContextMenuRef.current?.contains(target)
      ) {
        return
      }

      closePullContextMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePullContextMenu()
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", closePullContextMenu)
    window.addEventListener("scroll", closePullContextMenu, true)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", closePullContextMenu)
      window.removeEventListener("scroll", closePullContextMenu, true)
    }
  }, [pullContextMenu])

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return
      }

      const ctrlOrMeta = event.ctrlKey || event.metaKey

      if (ctrlOrMeta && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        if (mode === "draw" && draftDrawing.length > 0) {
          cancelDraftDrawing()
        } else {
          setMode("pulls")
        }
        return
      }

      if (event.key === "Backspace") {
        event.preventDefault()
        deleteSelectedPull({ moveUp: true })
        return
      }

      if (
        event.key === "Delete" ||
        (!ctrlOrMeta && event.key.toLowerCase() === "d")
      ) {
        event.preventDefault()
        deleteSelectedPull()
        return
      }

      if (!ctrlOrMeta && event.key === "Tab") {
        event.preventDefault()
        selectPullRelative(event.shiftKey ? -1 : 1)
        return
      }

      if (
        !ctrlOrMeta &&
        (event.key === "ArrowUp" || event.key === "ArrowLeft")
      ) {
        event.preventDefault()
        selectPullRelative(-1)
        return
      }

      if (
        !ctrlOrMeta &&
        (event.key === "ArrowDown" || event.key === "ArrowRight")
      ) {
        event.preventDefault()
        selectPullRelative(1)
        return
      }

      if (!ctrlOrMeta && !event.altKey && /^[0-9]$/.test(event.key)) {
        event.preventDefault()
        const value = Number(event.key)
        const index = value === 0 ? 9 : value - 1
        const pull = route.pulls[index]
        if (pull) {
          selectPull(pull.id)
        }
        return
      }

      if (!ctrlOrMeta && !event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault()
        setMode("draw")
        return
      }

      if (!ctrlOrMeta && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault()
        prependPull()
        return
      }

      if (!ctrlOrMeta && !event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault()
        if (event.shiftKey) {
          addPull()
        } else {
          appendPull()
        }
        return
      }

      if (!ctrlOrMeta && !event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault()
        clearSelectedPull()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    addPull,
    appendPull,
    cancelDraftDrawing,
    clearSelectedPull,
    deleteSelectedPull,
    draftDrawing.length,
    mode,
    prependPull,
    redo,
    route?.pulls,
    selectPull,
    selectPullRelative,
    setMode,
    undo,
  ])

  if (!hydrated || !route) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Loading smartRoute planner...
      </div>
    )
  }

  async function handleCopyMdt() {
    try {
      const value = await exportMdtRoute({ data: { route } })
      await navigator.clipboard.writeText(value)
      toast.info("MDT string copied to clipboard.")
    } catch {
      toast.error("Failed to export the route to an MDT string.")
    }
  }

  async function handleGenerateShare() {
    if (typeof window === "undefined") {
      return
    }

    try {
      const shareId = await createSharedRoute({
        data: { route, shareId: route.shareId },
      })
      if (route.shareId !== shareId) {
        setActiveRouteShareId(shareId)
      }
      const shareUrl = new URL(`/s/${shareId}`, window.location.origin)
      await navigator.clipboard.writeText(shareUrl.toString())
      toast.info("Share link copied to clipboard.")
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (
        message.includes("TURSO_DATABASE_URL") ||
        message.includes("TURSO_AUTH_TOKEN")
      ) {
        toast.error("Share links are not configured. Set the Turso environment variables.")
        return
      }

      toast.error("Could not create a share link.")
    }
  }

  async function handleImportConfirm() {
    try {
      const imported = await importMdtRoute({ data: { text: importValue } })
      importSharedRoute(imported)
      setImportValue("")
      setDialogMode(null)
      setStatusMessage("Imported MDT route.")
    } catch {
      setStatusMessage("Could not import that MDT string.")
    }
  }

  function commitRouteName() {
    renameActiveRoute(routeName)
    setDialogMode(null)
  }

  async function handleImportLibraryRoute({
    routeId,
    routeName,
    mdt,
    successMessage,
    errorMessage,
  }: {
    routeId: string
    routeName: string
    mdt: string
    successMessage: string
    errorMessage: string
  }) {
    setLoadingRouteLibraryId(routeId)

    try {
      const imported = await importMdtRoute({ data: { text: mdt } })
      importSharedRoute({
        ...imported,
        name: routeName,
      })
      setStatusMessage(successMessage)
    } catch {
      setStatusMessage(errorMessage)
    } finally {
      setLoadingRouteLibraryId(null)
    }
  }

  async function handleImportSampleRoute(sampleRouteId: string) {
    const sampleRoute = sampleRoutes.find(
      (routeOption) => routeOption.id === sampleRouteId,
    )
    if (!sampleRoute) {
      return
    }

    await handleImportLibraryRoute({
      routeId: sampleRoute.id,
      routeName: sampleRoute.name,
      mdt: sampleRoute.mdt,
      successMessage: `Imported sample route: ${sampleRoute.name}.`,
      errorMessage: `Could not import sample route: ${sampleRoute.name}.`,
    })
  }

  async function handleImportTopRoute(topRouteId: string) {
    const topRoute = topRuns.find(
      (routeOption) => `top-run-${routeOption.runId}` === topRouteId,
    )
    if (!topRoute) {
      return
    }

    const tankName =
      topRoute.team.find((member) => member.role === "tank")?.name ??
      topRoute.team[0]?.name ??
      "Unknown"

    await handleImportLibraryRoute({
      routeId: topRouteId,
      routeName: `Rank ${topRoute.rank} ${tankName} +${topRoute.mythicLevel}`,
      mdt: topRoute.mdt,
      successMessage: `Imported top route: Rank ${topRoute.rank} ${tankName} +${topRoute.mythicLevel}.`,
      errorMessage: `Could not import top route: Rank ${topRoute.rank} ${tankName} +${topRoute.mythicLevel}.`,
    })
  }

  function handleRouteLibrarySelect(option: RouteLibraryOption) {
    if (option.kind === "sample") {
      void handleImportSampleRoute(option.id)
      return
    }

    void handleImportTopRoute(option.id)
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh flex-col">
        <main className="relative flex-1 overflow-hidden bg-background">
          <section className="absolute inset-0">
            <div className="h-full">
              <PlannerMap />
            </div>
          </section>

          <section className="pointer-events-none absolute left-0 top-0 z-[450] max-w-[calc(100%-22rem)] p-3 md:p-4">
            <div className="pointer-events-auto flex flex-wrap gap-2">
              {dungeons.map((item) => {
                const active = item.key === dungeonKey

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDungeon(item.key)}
                    className={`group w-24 overflow-hidden border text-left shadow-lg backdrop-blur transition ${
                      active
                        ? "border-primary bg-card/92"
                        : "border-border/60 bg-card/72 hover:border-primary/40 hover:bg-primary/88"
                    }`}
                  >
                    <div className="relative h-14 overflow-hidden bg-muted">
                      <img
                        alt={item.name}
                        src={getDungeonIconUrl(item.icon)}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/10 to-transparent" />
                      <div className="absolute bottom-1 left-1.5 text-[9px] uppercase tracking-[0.22em] text-white/90">
                        {item.shortName}
                      </div>
                    </div>
                    <div className="truncate px-2 py-1.5 text-[10px] text-foreground">
                      {item.name}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="pointer-events-none absolute inset-y-0 right-0 z-450 w-full max-w-104 p-3 md:p-4">
            <div className="pointer-events-auto flex h-full flex-col rounded-none border border-border bg-card/88 shadow-2xl backdrop-blur">
              {statusMessage ? (
                <Card
                  size="sm"
                  className="border border-primary/20 bg-primary/5"
                >
                  <CardContent className="py-3 text-xs text-primary">
                    {statusMessage}
                  </CardContent>
                </Card>
              ) : null}

              <Card className="flex min-h-0 flex-1 flex-col">
                <CardHeader>
                  <CardTitle>Route Summary</CardTitle>
                  <CardDescription>{dungeon.name}</CardDescription>
                </CardHeader>
                <TooltipProvider delayDuration={120}>
                  <CardContent className="flex min-h-0 flex-1 flex-col space-y-1.5">
                    <div>
                      <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Route
                        </div>
                        <div className="flex gap-1">
                          <Select value={route.id} onValueChange={selectRoute}>
                            <SelectTrigger className="w-full min-w-0">
                              <SelectValue placeholder="Select route" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              className="z-[500] border border-border bg-popover"
                            >
                              {routeOptions.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <ToolbarActionButton
                            onClick={() => setDialogMode("rename")}
                            aria-label="Rename route"
                            tooltip="Rename route"
                          >
                            <PencilLine />
                          </ToolbarActionButton>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ToolbarActionButton
                        onClick={undo}
                        aria-label="Undo"
                        tooltip="Undo"
                      >
                        <Undo2 />
                      </ToolbarActionButton>
                      <ToolbarActionButton
                        onClick={redo}
                        aria-label="Redo"
                        tooltip="Redo"
                      >
                        <Redo2 />
                      </ToolbarActionButton>
                      <div className="h-5 w-px bg-border/70" />
                      <ToolbarActionButton
                        onClick={createRoute}
                        aria-label="New route"
                        tooltip="New route"
                      >
                        <Plus />
                      </ToolbarActionButton>
                      <ToolbarActionButton
                        onClick={() => setDialogMode("import")}
                        aria-label="Import MDT"
                        tooltip="Import MDT"
                      >
                        <ArrowUpToLine />
                      </ToolbarActionButton>
                      <ToolbarActionButton
                        onClick={handleCopyMdt}
                        aria-label="Export MDT"
                        tooltip="Export MDT"
                      >
                        <ArrowDownToLine />
                      </ToolbarActionButton>
                      <ToolbarActionButton
                        onClick={handleGenerateShare}
                        aria-label="Generate share link"
                        tooltip="Generate share link"
                      >
                        <Link2 />
                      </ToolbarActionButton>
                      <div className="h-5 w-px bg-border/70" />
                      <ToolbarActionButton
                        onClick={duplicateActiveRoute}
                        aria-label="Duplicate route"
                        tooltip="Duplicate route"
                      >
                        <Copy />
                      </ToolbarActionButton>
                      <ToolbarActionButton
                        onClick={clearActiveRoute}
                        aria-label="Clear route"
                        tooltip="Clear route"
                      >
                        <Eraser />
                      </ToolbarActionButton>
                      <ToolbarActionButton
                        onClick={deleteActiveRoute}
                        aria-label="Delete route"
                        tooltip="Delete route"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </ToolbarActionButton>
                    </div>
                    <div className="pt-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-auto w-full justify-between px-3 py-2 text-left"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm text-foreground">
                                Route Library
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {sampleRoutes.length} sample routes {" • "}
                                {topRuns.length} top routes
                              </span>
                            </span>
                            {loadingRouteLibraryId ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Route className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="z-[500] w-96 border border-border bg-popover"
                        >
                          <div className="px-2 py-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Route Library
                          </div>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Sample Routes
                          </div>
                          {routeLibraryOptions
                            .filter((option) => option.kind === "sample")
                            .map((option) => (
                              <DropdownMenuItem
                                key={option.id}
                                onClick={() => handleRouteLibrarySelect(option)}
                                disabled={
                                  loadingRouteLibraryId !== null ||
                                  loadingRouteLibraryId === option.id
                                }
                                className="flex items-start justify-between gap-3"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm text-foreground">
                                    {option.label}
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {option.detail}
                                  </span>
                                </span>
                                {loadingRouteLibraryId === option.id ? (
                                  <LoaderCircle className="mt-0.5 size-4 animate-spin" />
                                ) : (
                                  <ArrowUpToLine className="mt-0.5 size-4 shrink-0" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          {sampleRoutes.length === 0 ? (
                            <DropdownMenuItem disabled>
                              No sample routes for this dungeon.
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Top Routes
                          </div>
                          {topRunsState === "loading" ? (
                            <DropdownMenuItem disabled>
                              <LoaderCircle className="size-4 animate-spin" />
                              Loading top routes...
                            </DropdownMenuItem>
                          ) : null}
                          {topRunsState === "error" ? (
                            <DropdownMenuItem disabled>
                              Could not load importable top routes.
                            </DropdownMenuItem>
                          ) : null}
                          {topRunsState === "ready" && topRuns.length === 0 ? (
                            <DropdownMenuItem disabled>
                              No importable top routes found for this dungeon.
                            </DropdownMenuItem>
                          ) : null}
                          {routeLibraryOptions
                            .filter((option) => option.kind === "top-run")
                            .map((option) => (
                              <DropdownMenuItem
                                key={option.id}
                                onClick={() => handleRouteLibrarySelect(option)}
                                disabled={loadingRouteLibraryId !== null}
                                className="flex items-start justify-between gap-3"
                              >
                                <span className="min-w-0">
                                  <span className="flex items-center gap-2">
                                    <span className="inline-flex shrink-0 items-center rounded-sm border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                      {option.badge}
                                    </span>
                                    <span className="truncate text-sm text-foreground">
                                      {option.label}
                                    </span>
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {option.detail}
                                  </span>
                                  <span className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11px]">
                                    {option.team.map((member) => (
                                      <span
                                        key={`${option.id}-${member.name}`}
                                        style={{
                                          color: getClassColor(
                                            member.className,
                                          ),
                                        }}
                                      >
                                        {member.name}
                                      </span>
                                    ))}
                                  </span>
                                </span>
                                {loadingRouteLibraryId === option.id ? (
                                  <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
                                ) : (
                                  <ArrowUpToLine className="mt-0.5 size-4 shrink-0" />
                                )}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Tabs
                      className="flex min-h-0 flex-1 flex-col"
                      value={mode}
                      onValueChange={(value) => setMode(value as typeof mode)}
                    >
                      <TabsList variant="line" className="bg-transparent p-0">
                        <TabsTrigger value="pulls">
                          <Route />
                          Pulls
                        </TabsTrigger>
                        <TabsTrigger value="notes">
                          <StickyNote />
                          Notes
                        </TabsTrigger>
                        <TabsTrigger value="draw">
                          <Shapes />
                          Draw
                        </TabsTrigger>
                      </TabsList>
                      <div className="pt-2 text-xs">
                        <div className="border border-border/60 bg-background px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Enemy Forces
                          </div>
                          <div className="mt-1 text-lg text-foreground">
                            {formatEnemyForces(totalCount)}
                          </div>
                        </div>
                      </div>

                      <TabsContent
                        value="pulls"
                        className="mt-0 flex min-h-0 flex-1 flex-col space-y-2 pt-2"
                      >
                        <Card className="flex min-h-0 flex-1 flex-col">
                          <CardHeader>
                            <CardTitle>Pull Planner</CardTitle>
                          </CardHeader>
                          <CardContent className="flex min-h-0 flex-1 flex-col space-y-1.5">
                            <ScrollArea className="min-h-0 flex-1">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                              >
                                <SortableContext
                                  items={route.pulls.map((pull) => pull.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-1 pr-2">
                                    {route.pulls.map((pull, index) => (
                                      <SortablePullItem
                                        key={pull.id}
                                        pull={pull}
                                        index={index}
                                        pullSummary={pullSummaries[index]}
                                        isActive={pull.id === selectedPullId}
                                        onSelect={selectPull}
                                        onOpenContextMenu={handleOpenPullContextMenu}
                                        formatEnemyForces={formatEnemyForces}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            </ScrollArea>
                            <div className="grid grid-cols-2 gap-1">
                              <Button
                                variant="outline"
                                onClick={addPull}
                                className="h-auto justify-start px-3 py-2 text-left"
                              >
                                <Plus />
                                Add Pull
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => deleteSelectedPull()}
                                className="h-auto justify-start px-3 py-2 text-left"
                              >
                                Delete
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="notes" className="pt-2">
                        <Card>
                          <CardHeader>
                            <CardTitle>Notes</CardTitle>
                            <CardDescription>
                              Switch the map to note mode and click anywhere to
                              place a note.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-1.5">
                            {route.notes.length === 0 ? (
                              <div className="border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
                                Switch the map to note mode and click anywhere
                                to place a note.
                              </div>
                            ) : (
                              route.notes.map((note, index) => (
                                <div
                                  key={note.id}
                                  className="space-y-1.5 border border-border/60 bg-background p-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                      Note {index + 1}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => deleteNote(note.id)}
                                    >
                                      <Trash2 />
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={note.text}
                                    onChange={(event) =>
                                      updateNote(note.id, event.target.value)
                                    }
                                  />
                                </div>
                              ))
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="draw" className="pt-2">
                        <Card>
                          <CardHeader>
                            <CardTitle>Drawings</CardTitle>
                            <CardDescription>
                              Switch the map to draw mode and click to place
                              line points.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-1.5">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={commitDraftDrawing}
                              >
                                Finish Draft
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelDraftDrawing}
                              >
                                Cancel Draft
                              </Button>
                            </div>
                            <div className="border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
                              {draftDrawing.length > 0
                                ? `${draftDrawing.length} draft points placed. Click Finish Draft to save the line.`
                                : "Switch the map to draw mode and click to place line points."}
                            </div>
                            {route.drawings.map((drawing, index) => (
                              <div
                                key={drawing.id}
                                className="border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground"
                              >
                                Drawing {index + 1}: {drawing.points.length}{" "}
                                points
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </TooltipProvider>
              </Card>
            </div>
          </aside>
        </main>
      </div>

      {pullContextMenu ? (
        <div
          ref={pullContextMenuRef}
          style={{ top: pullContextMenu.y, left: pullContextMenu.x }}
          className="fixed z-[900] min-w-44 overflow-hidden border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/20"
        >
          <button
            type="button"
            onClick={handleContextInsertBefore}
            className="flex w-full items-center px-2 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Insert before
          </button>
          <button
            type="button"
            onClick={handleContextInsertAfter}
            className="flex w-full items-center px-2 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Insert after
          </button>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={handleContextClearPull}
            className="flex w-full items-center px-2 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Clear pull
          </button>
          <button
            type="button"
            onClick={handleContextDeletePull}
            className="flex w-full items-center px-2 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
          >
            Delete pull
          </button>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={handleContextClearRoute}
            className="flex w-full items-center px-2 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
          >
            Clear route
          </button>
        </div>
      ) : null}

      <Dialog
        open={dialogMode === "import"}
        onOpenChange={(open) => (!open ? setDialogMode(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import MDT Route</DialogTitle>
            <DialogDescription>
              Paste a Mythic Dungeon Tools export string. The route will be
              converted into the local planner schema.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importValue}
            onChange={(event) => setImportValue(event.target.value)}
            placeholder="Paste MDT string here"
            className="min-h-48"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button onClick={handleImportConfirm}>
              <Clipboard />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMode === "rename"}
        onOpenChange={(open) => (!open ? setDialogMode(null) : null)}
      >
        <DialogContent className="z-[600]">
          <DialogHeader>
            <DialogTitle>Rename Route</DialogTitle>
            <DialogDescription>
              Update the current route name.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={routeName}
            onChange={(event) => setRouteName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitRouteName()
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button onClick={commitRouteName}>
              <PencilLine />
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}