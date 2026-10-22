import type { ResearchBoardInput } from '@/features/research-map/board/boardInput'
import type { RecognizedCell } from '@/features/research-map/recognition/types'

export function recognizedMapToBoardInput(
  radius: number,
  cells: RecognizedCell[],
): ResearchBoardInput {
  const unresolved = cells.filter((cell) => cell.type === 'unknown')
  if (unresolved.length > 0) {
    throw new Error(`Review ${unresolved.length} uncertain cells before importing.`)
  }
  return {
    radius,
    cells: cells.flatMap((cell): ResearchBoardInput['cells'] => {
      if (cell.type === 'aspect' && cell.aspect) {
        return [{ row: cell.row, column: cell.column, type: 'aspect', aspect: cell.aspect }]
      }
      if (cell.type === 'obstacle') {
        return [{ row: cell.row, column: cell.column, type: 'obstacle' }]
      }
      return []
    }),
  }
}
