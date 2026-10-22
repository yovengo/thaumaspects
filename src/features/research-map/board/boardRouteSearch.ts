import { boardDistance, getBoardNeighbors } from '@/features/research-map/board/boardGeometry'

export type BoardSearchProgress = { source: string; target: string; path: string[] }
export type BoardSearchObserver = (progress: BoardSearchProgress) => void

type RouteSearch = {
  source: string
  target: string
  blockedCells: Set<string>
  boardSize: number
  onSearch?: BoardSearchObserver
}

type RouteCandidatesSearch = RouteSearch & {
  cellCount: number
  maxRoutes: number
  maxExploredStates: number
}

export function findShortestBoardRoute({
  source,
  target,
  blockedCells,
  boardSize,
  onSearch,
}: RouteSearch): string[] | null {
  const queue: string[][] = [[source]]
  const visited = new Set([source])
  let nextInQueue = 0

  while (nextInQueue < queue.length) {
    const route = queue[nextInQueue]
    nextInQueue += 1
    const current = route[route.length - 1]

    onSearch?.({ source, target, path: route })
    if (current === target) return route

    for (const neighbor of getBoardNeighbors(current, boardSize)) {
      if (visited.has(neighbor) || blockedCells.has(neighbor)) continue
      visited.add(neighbor)
      queue.push([...route, neighbor])
    }
  }

  return null
}

export function findBoardRoutesWithCellCount({
  source,
  target,
  blockedCells,
  boardSize,
  cellCount,
  maxRoutes,
  maxExploredStates,
  onSearch,
}: RouteCandidatesSearch): string[][] {
  const routes: string[][] = []
  let exploredStates = 0

  const walk = (current: string, route: string[], visited: Set<string>) => {
    if (exploredStates >= maxExploredStates || routes.length >= maxRoutes) return
    exploredStates += 1

    if (exploredStates % 16 === 0) onSearch?.({ source, target, path: route })

    const stepsLeft = cellCount - route.length
    if (boardDistance(current, target) > stepsLeft) return

    if (stepsLeft === 0) {
      if (current === target) routes.push(route)
      return
    }

    const neighbors = getBoardNeighbors(current, boardSize)
      .filter((neighbor) => !visited.has(neighbor) && !blockedCells.has(neighbor))
      .sort((left, right) => boardDistance(left, target) - boardDistance(right, target))

    for (const neighbor of neighbors) {
      if (neighbor === target && stepsLeft !== 1) continue

      const nextVisited = new Set(visited)
      nextVisited.add(neighbor)
      walk(neighbor, [...route, neighbor], nextVisited)
    }
  }

  walk(source, [source], new Set([source]))
  return routes
}
