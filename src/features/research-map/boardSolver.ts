import { boardDistance, getBoardNeighbors, routeTurns } from './boardGeometry'
import { createAspectPathFinder } from './model/aspectGraph'
import type { Catalog } from './model/types'

export type BoardSearchProgress = { source: string; target: string; path: string[] }
type BoardSearchObserver = (progress: BoardSearchProgress) => void

function findShortestBoardRoute(
  start: string,
  finish: string,
  occupied: Set<string>,
  boardSize: number,
  onSearch?: BoardSearchObserver,
) {
  const queue: string[][] = [[start]]
  const visited = new Set([start])

  while (queue.length) {
    const route = queue.shift()!
    const current = route[route.length - 1]
    onSearch?.({ source: start, target: finish, path: route })
    if (current === finish) return route
    for (const next of getBoardNeighbors(current, boardSize)) {
      if (visited.has(next) || (occupied.has(next) && next !== finish)) continue
      visited.add(next)
      queue.push([...route, next])
    }
  }
  return null
}

function findBoardRouteCandidates(
  start: string,
  finish: string,
  length: number,
  occupied: Set<string>,
  boardSize: number,
  limit = 32,
  onSearch?: BoardSearchObserver,
) {
  let attempts = 0
  const candidates: string[][] = []

  const walk = (current: string, route: string[], visited: Set<string>) => {
    attempts += 1
    if (attempts % 16 === 0) onSearch?.({ source: start, target: finish, path: route })
    if (attempts > 30000 || candidates.length >= limit) return
    const remainingEdges = length - route.length
    if (boardDistance(current, finish) > remainingEdges) return
    if (route.length === length) {
      if (current === finish) candidates.push(route)
      return
    }

    const options = getBoardNeighbors(current, boardSize)
      .filter((next) => !visited.has(next) && (!occupied.has(next) || next === finish))
      .sort((a, b) => boardDistance(a, finish) - boardDistance(b, finish))

    for (const next of options) {
      if (next === finish && remainingEdges !== 1) continue
      const nextVisited = new Set(visited)
      nextVisited.add(next)
      walk(next, [...route, next], nextVisited)
    }
  }

  walk(start, [start], new Set([start]))
  return candidates.sort((a, b) => routeTurns(a) - routeTurns(b))
}

export type SolvedBoard = {
  board: Record<string, string>
  routes: string[][]
  message: string
}

export function solveAllAnchors(
  board: Record<string, string>,
  anchorCells: Set<string>,
  obstacles: Set<string>,
  boardSize: number,
  catalog: Catalog,
  enabled: Set<string>,
  onSearch?: BoardSearchObserver,
): SolvedBoard | { message: string } {
  const anchors = [...anchorCells].filter((id) => board[id] && !obstacles.has(id))
  if (anchors.length < 2)
    return { message: 'Place at least two source aspects on the map before using auto-connect.' }

  const workingBoard = Object.fromEntries(anchors.map((id) => [id, board[id]])) as Record<
    string,
    string
  >
  const connected = new Set<string>([anchors[0]])
  const remaining = new Set(anchors.slice(1))
  const routes: string[][] = []
  const findAspectPath = createAspectPathFinder(catalog.combinations, enabled)

  while (remaining.size) {
    let best: { target: string; route: string[]; aspects: string[]; score: number } | null = null

    for (const target of remaining) {
      for (const source of connected) {
        const occupied = new Set([
          ...Object.keys(workingBoard).filter((id) => id !== source && id !== target),
          ...obstacles,
        ])
        const shortestRoute = findShortestBoardRoute(source, target, occupied, boardSize, onSearch)
        if (!shortestRoute) continue

        for (let extraSpaces = 0; extraSpaces <= 2; extraSpaces += 1) {
          const aspectPath = findAspectPath(
            workingBoard[source],
            workingBoard[target],
            Math.max(0, shortestRoute.length - 2 + extraSpaces),
          )
          if (!aspectPath) continue
          const routeCandidates = findBoardRouteCandidates(
            source,
            target,
            aspectPath.length,
            occupied,
            boardSize,
            12,
            onSearch,
          )

          for (const route of routeCandidates) {
            const futureNetwork = new Set([...connected, ...route])
            const occupiedAfterRoute = new Set([
              ...occupied,
              ...route.filter((id) => id !== target),
            ])
            let futurePenalty = 0

            for (const futureTarget of remaining) {
              if (futureTarget === target) continue
              const distanceToNetwork = Math.min(
                ...[...futureNetwork].map((id) => boardDistance(id, futureTarget)),
              )
              const hasExit = getBoardNeighbors(futureTarget, boardSize).some(
                (id) => !occupiedAfterRoute.has(id) || futureNetwork.has(id),
              )
              futurePenalty += distanceToNetwork * 3 + (hasExit ? 0 : 100000)
            }

            const score = route.length * 1000 + routeTurns(route) * 12 + futurePenalty
            if (!best || score < best.score) best = { target, route, aspects: aspectPath, score }
          }
        }
      }
    }

    if (!best)
      return {
        message:
          'The source aspects cannot all be connected. Remove some obstacles or move the isolated aspects.',
      }

    best.route.forEach((id, index) => {
      workingBoard[id] = best.aspects[index]
      connected.add(id)
    })
    remaining.delete(best.target)
    routes.push(best.route)
  }

  return {
    board: workingBoard,
    routes,
    message: `Auto-connected ${anchors.length} source aspects with ${routes.length} optimal branches.`,
  }
}
