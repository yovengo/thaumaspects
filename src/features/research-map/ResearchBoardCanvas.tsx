import { AspectIcon } from '../../components/AspectIcon'
import { aspectLabel } from '../../lib/catalog'
import {
  cellId,
  getBoardCells,
  hexColumnStep,
  hexHeight,
  hexRowStep,
  hexWidth,
  parseCellId,
} from './boardGeometry'

export function ResearchBoardCanvas({ boardSize, board, anchorCells, obstacles, selectedCells, routes, routeOrder, editingObstacles, onMoveAspect, onPlaceAspect, onSelectCell, onToggleObstacle, onRemoveAspect }: {
  boardSize: number
  board: Record<string, string>
  anchorCells: Set<string>
  obstacles: Set<string>
  selectedCells: string[]
  routes: string[][]
  routeOrder: Map<string, number>
  editingObstacles: boolean
  onMoveAspect: (source: string, target: string) => void
  onPlaceAspect: (target: string, aspect: string) => void
  onSelectCell: (id: string) => void
  onToggleObstacle: (id: string) => void
  onRemoveAspect: (id: string) => void
}) {
  return <div className="board-grid"><div className="board-grid-canvas" style={{
    width: (boardSize - 1) * hexColumnStep + hexWidth,
    height: (boardSize - 1) * hexRowStep + hexHeight + hexRowStep / 2,
  }}>
    {routes.length > 0 && <svg className="board-route-lines" aria-hidden="true">{routes.map((route, index) => <polyline key={index} points={route.map((id) => {
      const [row, column] = parseCellId(id)
      return `${column * hexColumnStep + hexWidth / 2},${row * hexRowStep + (column % 2) * hexRowStep / 2 + hexHeight / 2}`
    }).join(' ')} />)}</svg>}
    {getBoardCells(boardSize).map(({ row, column }) => {
      const id = cellId(row, column)
      const aspect = board[id]
      const routeNumber = routeOrder.get(id)
      const blocked = obstacles.has(id)
      return <div
        key={id}
        style={{ left: column * hexColumnStep, top: row * hexRowStep + (column % 2) * hexRowStep / 2 }}
        draggable={Boolean(aspect)}
        onDragStart={(event) => {
          if (aspect) {
            event.dataTransfer.setData('text/aspect', aspect)
            event.dataTransfer.setData('text/board-cell', id)
          }
        }}
        className={`board-cell ${aspect ? 'has-aspect' : ''} ${anchorCells.has(id) ? 'is-anchor' : ''} ${blocked ? 'is-blocked' : ''} ${selectedCells.includes(id) ? 'is-selected' : ''} ${routeNumber !== undefined ? 'is-route' : ''}`}
        onDragOver={(event) => { if (!blocked) event.preventDefault() }}
        onDrop={(event) => {
          event.preventDefault()
          const source = event.dataTransfer.getData('text/board-cell')
          const dropped = event.dataTransfer.getData('text/aspect')
          if (source) onMoveAspect(source, id)
          else if (dropped && !blocked) onPlaceAspect(id, dropped)
        }}
        onClick={() => {
          if (editingObstacles && !aspect) onToggleObstacle(id)
          else onSelectCell(id)
        }}
      >
        {blocked ? <span className="blocked-mark">✕</span> : aspect && <>
          {routeNumber !== undefined && <span className="cell-order">{routeNumber}</span>}
          <AspectIcon aspect={aspect} /><b>{aspectLabel(aspect)}</b><small>{aspect}</small>
          <button type="button" className="remove-cell" onClick={(event) => { event.stopPropagation(); onRemoveAspect(id) }} aria-label={`Remove ${aspectLabel(aspect)} from the map`}>×</button>
        </>}
      </div>
    })}
  </div></div>
}
