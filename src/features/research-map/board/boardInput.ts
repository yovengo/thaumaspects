import {
  cellId,
  getBoardCells,
  maximumBoardSize,
  minimumBoardSize,
  parseCellId,
} from '@/features/research-map/board/boardGeometry'
import { aspectLabel } from '@/features/research-map/model/catalog'
import type { Catalog } from '@/features/research-map/model/types'

export type ResearchBoardInput = {
  radius: number
  cells: Array<
    | { row: number; column: number; type: 'aspect'; aspect: string }
    | { row: number; column: number; type: 'obstacle' }
  >
}

export type ImportedResearchBoard = {
  boardSize: number
  board: Record<string, string>
  anchorCells: string[]
  obstacles: string[]
}

export function parseResearchBoardInput(
  input: ResearchBoardInput,
  catalog: Catalog,
): ImportedResearchBoard {
  if (!input || !Number.isInteger(input.radius)) {
    throw new Error('Map radius must be a whole number.')
  }

  const boardSize = input.radius * 2 + 1
  if (boardSize < minimumBoardSize || boardSize > maximumBoardSize) {
    throw new Error(
      `Map radius must be between ${Math.floor(minimumBoardSize / 2)} and ${Math.floor(maximumBoardSize / 2)}.`,
    )
  }
  if (!Array.isArray(input.cells)) {
    throw new Error('Map cells must be an array.')
  }

  const validCells = new Set(getBoardCells(boardSize).map(({ row, column }) => cellId(row, column)))
  const aspectsByName = new Map<string, string>()
  for (const aspect of catalog.aspects) {
    aspectsByName.set(aspect.toLowerCase(), aspect)
    aspectsByName.set(aspectLabel(aspect).toLowerCase(), aspect)
  }

  const board: Record<string, string> = {}
  const anchorCells: string[] = []
  const obstacles: string[] = []
  const seenCells = new Set<string>()

  for (const cell of input.cells) {
    if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.column)) {
      throw new Error('Every map cell needs whole-number row and column coordinates.')
    }

    const id = cellId(cell.row, cell.column)
    if (!validCells.has(id)) throw new Error(`Cell ${id} is outside the map.`)
    if (seenCells.has(id)) throw new Error(`Cell ${id} appears more than once.`)
    seenCells.add(id)

    if (cell.type === 'obstacle') {
      obstacles.push(id)
    } else if (cell.type === 'aspect' && typeof cell.aspect === 'string') {
      const aspect = aspectsByName.get(cell.aspect.trim().toLowerCase())
      if (!aspect) throw new Error(`Unknown aspect: ${cell.aspect}.`)
      board[id] = aspect
      anchorCells.push(id)
    } else {
      throw new Error(`Cell ${id} must be an aspect or obstacle.`)
    }
  }

  anchorCells.sort((first, second) => {
    const [firstRow, firstColumn] = parseCellId(first)
    const [secondRow, secondColumn] = parseCellId(second)
    return firstRow - secondRow || firstColumn - secondColumn
  })

  return { boardSize, board, anchorCells, obstacles }
}
