'use client'

import { BoardCell } from '@/features/research-map/board/BoardCell'
import {
  cellId,
  getBoardCells,
  hexColumnStep,
  hexHeight,
  hexRowStep,
  hexWidth,
  parseCellId,
} from '@/features/research-map/board/boardGeometry'
import type { ResearchBoardController } from '@/features/research-map/board/useResearchBoard'

const routePoints = (route: string[]) =>
  route
    .map((id) => {
      const [row, column] = parseCellId(id)
      return `${column * hexColumnStep + hexWidth / 2},${row * hexRowStep + ((column % 2) * hexRowStep) / 2 + hexHeight / 2}`
    })
    .join(' ')

export function BoardCanvas({ controller }: { controller: ResearchBoardController }) {
  const { solvePhase, boardSize, boardCanvasHeight, boardRoutes, searchTrace } = controller

  return (
    <div className="board-main">
      <div className="board-grid" aria-busy={solvePhase !== 'idle'}>
        <div
          className="board-grid-canvas"
          style={{
            width: (boardSize - 1) * hexColumnStep + hexWidth,
            height: boardCanvasHeight,
          }}
        >
          {(boardRoutes.length > 0 || (searchTrace?.path.length ?? 0) > 1) && (
            <svg
              className={`board-route-lines ${solvePhase === 'searching' ? 'is-searching' : ''}`}
              aria-hidden="true"
            >
              {boardRoutes.map((route) => (
                <polyline key={route.join('>')} points={routePoints(route)} />
              ))}
              {solvePhase === 'searching' && searchTrace && (
                <polyline className="board-search-line" points={routePoints(searchTrace.path)} />
              )}
            </svg>
          )}
          {getBoardCells(boardSize).map(({ row, column }) => (
            <BoardCell
              key={cellId(row, column)}
              row={row}
              column={column}
              controller={controller}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
