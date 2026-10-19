'use client'

import { cellId, hexColumnStep, hexRowStep } from '@/features/research-map/board/boardGeometry'
import type { ResearchBoardController } from '@/features/research-map/board/useResearchBoard'
import { AspectIcon, CloseIcon } from '@/features/research-map/icons'
import { aspectLabel as label } from '@/features/research-map/model/catalog'

export function BoardCell({
  row,
  column,
  controller,
}: {
  row: number
  column: number
  controller: ResearchBoardController
}) {
  const {
    solvePhase,
    pendingAspect,
    dragRef,
    board,
    boardRouteOrder,
    obstacles,
    searchCells,
    anchorCells,
    searchTrace,
    revealCell,
    moveAspect,
    placeAspect,
    toggleObstacle,
    removeAspect,
  } = controller
  const id = cellId(row, column)
  const aspect = board[id]
  const routeNumber = boardRouteOrder.get(id)
  const blocked = obstacles.has(id)

  const activateCell = () => {
    if (dragRef.current || solvePhase !== 'idle') return
    if (pendingAspect && !blocked) placeAspect(id, pendingAspect)
    else toggleObstacle(id)
  }

  return (
    // biome-ignore lint/a11y: Hex cells need drag and drop and can contain a nested remove button.
    <div
      role={aspect ? 'group' : 'button'}
      tabIndex={solvePhase === 'idle' ? 0 : -1}
      aria-disabled={solvePhase !== 'idle'}
      aria-label={
        aspect ? `${label(aspect)} on cell ${id}` : `Cell ${id}, ${blocked ? 'blocked' : 'open'}`
      }
      aria-pressed={aspect ? undefined : blocked}
      style={{
        left: column * hexColumnStep,
        top: row * hexRowStep + ((column % 2) * hexRowStep) / 2,
      }}
      draggable={Boolean(aspect) && solvePhase === 'idle'}
      onDragStart={(event) => {
        if (aspect) {
          dragRef.current = true
          event.dataTransfer.setData('text/aspect', aspect)
          event.dataTransfer.setData('text/board-cell', id)
        }
      }}
      onDragEnd={() =>
        window.setTimeout(() => {
          dragRef.current = false
        }, 0)
      }
      className={`board-cell ${aspect ? 'has-aspect' : ''} ${anchorCells.has(id) ? 'is-anchor' : ''} ${blocked ? 'is-blocked' : ''} ${routeNumber !== undefined ? 'is-route' : ''} ${searchCells.has(id) ? 'is-search-path' : ''} ${searchTrace?.source === id || searchTrace?.target === id ? 'is-search-endpoint' : ''} ${revealCell === id ? 'is-reveal-new' : ''}`}
      onDragOver={(event) => {
        if (!blocked && solvePhase === 'idle') event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (solvePhase !== 'idle') return
        dragRef.current = true
        const source = event.dataTransfer.getData('text/board-cell')
        const dropped = event.dataTransfer.getData('text/aspect')
        if (source) moveAspect(source, id)
        else if (dropped && !blocked) placeAspect(id, dropped)
        window.setTimeout(() => {
          dragRef.current = false
        }, 0)
      }}
      onClick={aspect ? undefined : activateCell}
      onKeyDown={(event) => {
        if (
          solvePhase === 'idle' &&
          !aspect &&
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault()
          activateCell()
        }
      }}
    >
      {blocked ? (
        <CloseIcon className="blocked-mark" />
      ) : (
        aspect && (
          <>
            {routeNumber !== undefined && <span className="cell-order">{routeNumber}</span>}
            <AspectIcon aspect={aspect} />
            <b>{label(aspect)}</b>
            <small>{aspect}</small>
            <button
              type="button"
              className="remove-cell"
              disabled={solvePhase !== 'idle'}
              onClick={(event) => {
                event.stopPropagation()
                removeAspect(id)
              }}
              aria-label={`Remove ${label(aspect)} from the map`}
            >
              <CloseIcon />
            </button>
          </>
        )
      )}
    </div>
  )
}
