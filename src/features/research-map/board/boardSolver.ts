import {
  type BoardSearchOptions,
  defaultBoardSearchOptions,
  findBestConnection,
} from '@/features/research-map/board/boardConnections'
import type { BoardSearchObserver } from '@/features/research-map/board/boardRouteSearch'
import { createAspectPathFinder } from '@/features/research-map/model/aspectGraph'
import type { Catalog } from '@/features/research-map/model/types'

export type { BoardSearchOptions } from '@/features/research-map/board/boardConnections'
export type { BoardSearchProgress } from '@/features/research-map/board/boardRouteSearch'

export type SolvedBoard = {
  board: Record<string, string>
  routes: string[][]
}

export type BoardSolveResult = SolvedBoard | { error: true }

type BoardSolveInput = {
  board: Record<string, string>
  anchorCells: Set<string>
  obstacles: Set<string>
  boardSize: number
  catalog: Catalog
  enabled: Set<string>
  onSearch?: BoardSearchObserver
  options?: BoardSearchOptions
}

export function solveAllAnchors({
  board,
  anchorCells,
  obstacles,
  boardSize,
  catalog,
  enabled,
  onSearch,
  options = defaultBoardSearchOptions,
}: BoardSolveInput): BoardSolveResult {
  const anchors = [...anchorCells].filter((cell) => board[cell] && !obstacles.has(cell))
  if (anchors.length < 2) return { error: true }

  const workingBoard = Object.fromEntries(anchors.map((cell) => [cell, board[cell]])) as Record<
    string,
    string
  >
  const connected = new Set<string>([anchors[0]])
  const remaining = new Set(anchors.slice(1))
  const routes: string[][] = []
  const { findPath: findAspectPath, findPathWithSteps: findAspectPathWithSteps } =
    createAspectPathFinder(catalog.combinations, enabled, catalog.aspectWeights)

  while (remaining.size > 0) {
    const connection = findBestConnection({
      board: workingBoard,
      connected,
      remaining,
      obstacles,
      boardSize,
      findAspectPath,
      findAspectPathWithSteps,
      aspectWeights: catalog.aspectWeights,
      options,
      onSearch,
    })
    if (!connection) return { error: true }

    connection.route.forEach((cell, index) => {
      workingBoard[cell] = connection.aspects[index]
      connected.add(cell)
    })
    remaining.delete(connection.target)
    routes.push(connection.route)
  }

  return { board: workingBoard, routes }
}
