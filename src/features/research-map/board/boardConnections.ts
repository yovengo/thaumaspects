import {
  assessConnection,
  type ConnectionCandidate,
  compareConnections,
} from '@/features/research-map/board/boardConnectionRanking'
import {
  type BoardSearchObserver,
  findBoardRoutesWithCellCount,
  findShortestBoardRoute,
} from '@/features/research-map/board/boardRouteSearch'

export type BoardSearchOptions = {
  maxExtraSpaces: number
  maxRoutesPerLength: number
  maxExploredStatesPerLength: number
}

export const defaultBoardSearchOptions: BoardSearchOptions = {
  maxExtraSpaces: 2,
  maxRoutesPerLength: 12,
  maxExploredStatesPerLength: 30000,
}

type ConnectionSearch = {
  board: Record<string, string>
  connected: Set<string>
  remaining: Set<string>
  obstacles: Set<string>
  boardSize: number
  findAspectPath: (from: string, to: string, minSpaces: number) => string[] | null
  options: BoardSearchOptions
  onSearch?: BoardSearchObserver
}

function findBestConnectionForPair(
  source: string,
  target: string,
  search: ConnectionSearch,
): ConnectionCandidate | null {
  const blockedCells = new Set([
    ...search.obstacles,
    ...Object.keys(search.board).filter((cell) => cell !== source && cell !== target),
  ])
  const shortestRoute = findShortestBoardRoute({
    source,
    target,
    blockedCells,
    boardSize: search.boardSize,
    onSearch: search.onSearch,
  })
  if (!shortestRoute) return null

  let best: ConnectionCandidate | null = null
  const searchedLengths = new Set<number>()

  for (let extraSpaces = 0; extraSpaces <= search.options.maxExtraSpaces; extraSpaces += 1) {
    const minimumSpaces = Math.max(0, shortestRoute.length - 2 + extraSpaces)
    const aspects = search.findAspectPath(search.board[source], search.board[target], minimumSpaces)
    if (!aspects || searchedLengths.has(aspects.length)) continue
    searchedLengths.add(aspects.length)

    const routes = findBoardRoutesWithCellCount({
      source,
      target,
      blockedCells,
      boardSize: search.boardSize,
      cellCount: aspects.length,
      maxRoutes: search.options.maxRoutesPerLength,
      maxExploredStates: search.options.maxExploredStatesPerLength,
      onSearch: search.onSearch,
    })

    for (const route of routes) {
      const candidate = assessConnection({
        route,
        aspects,
        target,
        blockedCells,
        connected: search.connected,
        remaining: search.remaining,
        boardSize: search.boardSize,
      })
      if (candidate && (!best || compareConnections(candidate, best) < 0)) best = candidate
    }
  }

  return best
}

export function findBestConnection(search: ConnectionSearch): ConnectionCandidate | null {
  let best: ConnectionCandidate | null = null

  for (const target of search.remaining) {
    for (const source of search.connected) {
      const candidate = findBestConnectionForPair(source, target, search)
      if (candidate && (!best || compareConnections(candidate, best) < 0)) best = candidate
    }
  }

  return best
}
