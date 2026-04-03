import type {
  DungeonDefinition,
  MdtNote,
  MdtPolygon,
  MdtRoute,
  PlannerDrawing,
  PlannerNote,
  PlannerRoute,
  Point,
  SpawnId,
} from "@/features/planner/types"
import {
  dungeonsByKey,
  dungeonsByMdtIndex,
} from "@/features/planner/data/dungeons"
import { createId } from "@/features/planner/lib/ids"
import { getPullColor } from "@/features/planner/lib/pull-colors"

const coordinateRatio = 2.185

function pointToMdt(point: Point): [number, number] {
  return [point[1] * coordinateRatio, point[0] * coordinateRatio]
}

function mdtPointToRoute(x: number, y: number): Point {
  return [y / coordinateRatio, x / coordinateRatio]
}

function noteToMdt(note: PlannerNote): MdtNote {
  const [x, y] = pointToMdt(note.position)
  return { d: [x, y, 1, true, note.text], n: true }
}

function drawingToMdtPolygon(drawing: PlannerDrawing): MdtPolygon {
  const segments: string[] = []
  let previous: [number, number] | null = null
  drawing.points.forEach((point) => {
    const current = pointToMdt(point)
    if (previous) {
      segments.push(
        String(previous[0]),
        String(previous[1]),
        String(current[0]),
        String(current[1]),
      )
    }
    previous = current
  })

  return {
    d: [drawing.weight, 1, 1, true, drawing.color.replace("#", ""), -8, true],
    l: segments,
  }
}

function mdtPolygonToDrawing(
  polygon: MdtPolygon,
  index: number,
): PlannerDrawing {
  const points: Point[] = []
  for (let cursor = 0; cursor < polygon.l.length; cursor += 2) {
    const x = Number(polygon.l[cursor])
    const y = Number(polygon.l[cursor + 1])
    const point = mdtPointToRoute(x, y)
    if (!points.some(([py, px]) => py === point[0] && px === point[1])) {
      points.push(point)
    }
  }

  return {
    id: `drawing_${index}`,
    color: `#${polygon.d[4]}`,
    weight: polygon.d[0],
    points,
  }
}

function mobSpawnsToMdtEnemies(spawns: SpawnId[], dungeon: DungeonDefinition) {
  return spawns.reduce<Record<number, number[]>>((acc, spawnId) => {
    const mobSpawn = dungeon.mobSpawns[spawnId]
    if (!mobSpawn) {
      return acc
    }

    acc[mobSpawn.mob.enemyIndex] ??= []
    acc[mobSpawn.mob.enemyIndex].push(mobSpawn.spawn.idx)
    return acc
  }, {})
}

export function plannerRouteToMdtRoute(route: PlannerRoute): MdtRoute {
  const dungeon = dungeonsByKey[route.dungeonKey]
  return {
    text: route.name,
    week: 1,
    difficulty: 10,
    uid: route.id,
    value: {
      currentPull: 0,
      currentSublevel: 1,
      currentDungeonIdx: dungeon.mdt.dungeonIndex,
      selection: [],
      pulls: route.pulls.map((pull) => ({
        color: pull.color.replace("#", ""),
        ...mobSpawnsToMdtEnemies(pull.spawns, dungeon),
      })),
    },
    objects: [
      ...route.notes.map(noteToMdt),
      ...route.drawings
        .filter((drawing) => drawing.points.length > 1)
        .map(drawingToMdtPolygon),
    ],
  }
}

export function mdtRouteToPlannerRoute(mdtRoute: MdtRoute): PlannerRoute {
  const dungeon = dungeonsByMdtIndex[mdtRoute.value.currentDungeonIdx]
  if (!dungeon) {
    throw new Error(
      `Unsupported dungeon index: ${mdtRoute.value.currentDungeonIdx}`,
    )
  }

  const objects = Array.isArray(mdtRoute.objects)
    ? mdtRoute.objects
    : Object.values(mdtRoute.objects)
  const pulls = mdtRoute.value.pulls.map((pull, index) => ({
    id: createId("pull"),
    label: `Pull ${index + 1}`,
    color: pull.color ? `#${pull.color}` : getPullColor(index),
    spawns: Object.entries(pull).flatMap(
      ([enemyIndexOrColor, spawnIndexes]) => {
        if (!Array.isArray(spawnIndexes)) {
          return []
        }

        const enemyIndex = Number(enemyIndexOrColor)
        return spawnIndexes.flatMap((spawnIndex) => {
          const match = dungeon.mobSpawnsList.find(
            ({ mob, spawn }) =>
              mob.enemyIndex === enemyIndex && spawn.idx === spawnIndex,
          )
          return match ? [match.spawn.id] : []
        })
      },
    ),
  }))

  const notes = objects
    .filter((object): object is MdtNote => "n" in object)
    .map((note) => ({
      id: createId("note"),
      text: note.d[4],
      position: mdtPointToRoute(note.d[0], note.d[1]),
    }))

  const drawings = objects
    .filter((object): object is MdtPolygon => "l" in object)
    .map(mdtPolygonToDrawing)

  const now = new Date().toISOString()

  return {
    id: createId("route"),
    schemaVersion: 1,
    name: mdtRoute.text || `${dungeon.name} Import`,
    dungeonKey: dungeon.key,
    pulls:
      pulls.length > 0
        ? pulls
        : [
            {
              id: createId("pull"),
              label: "Pull 1",
              color: getPullColor(0),
              spawns: [],
            },
          ],
    notes,
    drawings,
    stickers: [],
    createdAt: now,
    updatedAt: now,
  }
}
