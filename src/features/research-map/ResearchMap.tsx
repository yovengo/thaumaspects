import { useMemo, useState } from 'react'
import { AspectIcon } from '../../components/AspectIcon'
import { aspectLabel } from '../../lib/catalog'
import { findAspectPath } from '../../lib/aspectGraph'
import type { Catalog } from '../../types/domain'
import {
  defaultBoardSize,
  maximumBoardSize,
  minimumBoardSize,
} from './boardGeometry'
import { AspectPalette } from './AspectPalette'
import { findBoardRoute, findShortestBoardRoute, solveAllAnchors } from './boardSolver'
import { ResearchBoardCanvas } from './ResearchBoardCanvas'
import { ScreenshotImporter } from './ScreenshotImporter'
import type { RecognitionResult } from './screenshotRecognizer'

const initialMessage = 'Paste a screenshot or drag aspects onto the map.'

export function ResearchMap({ catalog, enabled, minSpaces }: {
  catalog: Catalog
  enabled: Set<string>
  minSpaces: number
}) {
  const [board, setBoard] = useState<Record<string, string>>({})
  const [anchorCells, setAnchorCells] = useState<Set<string>>(new Set())
  const [selectedCells, setSelectedCells] = useState<string[]>([])
  const [boardRoutes, setBoardRoutes] = useState<string[][]>([])
  const [boardMessage, setBoardMessage] = useState(initialMessage)
  const [obstacles, setObstacles] = useState<Set<string>>(new Set())
  const [editingObstacles, setEditingObstacles] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [boardSize, setBoardSize] = useState(defaultBoardSize)

  const paletteAspects = catalog.aspects.filter((aspect) => enabled.has(aspect)
    && `${aspectLabel(aspect)} ${aspect}`.toLocaleLowerCase().includes(paletteQuery.toLocaleLowerCase()))

  const boardRouteOrder = useMemo(() => {
    const order = new Map<string, number>()
    boardRoutes.forEach((route) => route.forEach((id) => {
      if (!order.has(id)) order.set(id, order.size + 1)
    }))
    return order
  }, [boardRoutes])

  const clearBoard = (message = 'Map cleared. Paste a screenshot or drag new aspects onto it.') => {
    setBoard({})
    setAnchorCells(new Set())
    setObstacles(new Set())
    setSelectedCells([])
    setBoardRoutes([])
    setBoardMessage(message)
  }

  const changeBoardSize = (nextSize: number) => {
    setBoardSize(nextSize)
    clearBoard(`Map resized to diameter ${nextSize}. Place the aspects again.`)
  }

  const importScreenshot = (recognized: RecognitionResult) => {
    setBoardSize(recognized.boardSize)
    setBoard(recognized.board)
    setAnchorCells(new Set(Object.keys(recognized.board)))
    setObstacles(recognized.obstacles)
    setSelectedCells([])
    setBoardRoutes([])
    setEditingObstacles(false)
    setBoardMessage(`Screenshot imported: ${Object.keys(recognized.board).length} source aspects and ${recognized.obstacles.size} obstacles detected. Check the map, then auto-connect it.`)
  }

  const placeAspect = (target: string, aspect: string) => {
    setBoard((previous) => ({ ...previous, [target]: aspect }))
    setAnchorCells((previous) => new Set(previous).add(target))
    setSelectedCells((previous) => previous.filter((id) => id !== target))
    setBoardRoutes([])
    setBoardMessage('Select the starting and ending aspects on the map.')
  }

  const moveAspect = (source: string, target: string) => {
    if (source === target || obstacles.has(target)) return
    setBoard((previous) => {
      const next = { ...previous, [target]: previous[source] }
      if (previous[target]) next[source] = previous[target]
      else delete next[source]
      return next
    })
    setAnchorCells((previous) => {
      const next = new Set(previous)
      const sourceIsAnchor = previous.has(source)
      const targetIsAnchor = previous.has(target)
      next.delete(source)
      next.delete(target)
      if (sourceIsAnchor) next.add(target)
      if (targetIsAnchor) next.add(source)
      return next
    })
    setSelectedCells((previous) => previous.map((id) => id === source ? target : id === target ? source : id))
    setBoardRoutes([])
    setBoardMessage('Aspect moved. Select endpoints or continue editing.')
  }

  const selectBoardCell = (id: string) => {
    if (!board[id]) return
    setBoardRoutes([])
    setSelectedCells((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous.slice(-1), id])
    setBoardMessage('Select the second aspect or build a chain.')
  }

  const buildBoardPath = () => {
    if (selectedCells.length !== 2) {
      setBoardMessage('Select exactly two aspects on the map: the start and end of the chain.')
      return
    }
    const [start, finish] = selectedCells
    const occupied = new Set([...Object.keys(board).filter((id) => id !== start && id !== finish), ...obstacles])
    const shortestRoute = findShortestBoardRoute(start, finish, occupied, boardSize)
    if (!shortestRoute) {
      setBoardMessage('There is no free route between the selected aspects. Remove some obstacles or aspects.')
      return
    }
    const requiredSpaces = Math.max(minSpaces, shortestRoute.length - 2)
    const path = findAspectPath(board[start], board[finish], requiredSpaces, catalog.combinations, enabled)
    if (!path) {
      setBoardMessage('No connection found. Enable more aspects or change the conditions.')
      return
    }
    const route = findBoardRoute(start, finish, path.length, occupied, boardSize)
    if (!route) {
      setBoardMessage('The chain could not fit cleanly. Free up nearby cells or move the endpoint aspects.')
      return
    }
    setBoard((previous) => {
      const next = { ...previous }
      route.forEach((id, index) => { next[id] = path[index] })
      return next
    })
    setBoardRoutes([route])
    setSelectedCells([])
    setBoardMessage(`Chain built with ${path.length - 2} intermediate aspects.`)
  }

  const solveEntireMap = () => {
    const solved = solveAllAnchors(board, anchorCells, obstacles, boardSize, catalog, enabled)
    setBoardMessage(solved.message)
    if (!('board' in solved)) return
    setBoard(solved.board)
    setBoardRoutes(solved.routes)
    setSelectedCells([])
  }

  return <section className="panel research-board" aria-label="Research map">
    <ScreenshotImporter aspects={catalog.aspects} onRecognized={importScreenshot} />
    <div className="board-layout">
      <AspectPalette aspects={paletteAspects} query={paletteQuery} onQueryChange={setPaletteQuery} />
      <div className="board-main">
        <div className="board-title">
          <div className="board-title-heading"><span className="step-number">2</span><div><p className="eyebrow">Knowledge infusion</p><h2>Research map</h2></div></div>
          <div className="board-size">
            <span>Grid diameter: <strong>{boardSize}</strong></span>
            <input aria-label="Grid diameter" type="range" min={minimumBoardSize} max={maximumBoardSize} step="2" value={boardSize} onChange={(event) => changeBoardSize(Number(event.target.value))} />
          </div>
          <span>{editingObstacles ? 'Click empty cells to toggle obstacles' : 'Paste a screenshot or edit the imported result'}</span>
        </div>
        <ResearchBoardCanvas
          boardSize={boardSize}
          board={board}
          anchorCells={anchorCells}
          obstacles={obstacles}
          selectedCells={selectedCells}
          routes={boardRoutes}
          routeOrder={boardRouteOrder}
          editingObstacles={editingObstacles}
          onMoveAspect={moveAspect}
          onPlaceAspect={placeAspect}
          onSelectCell={selectBoardCell}
          onToggleObstacle={(id) => {
            setObstacles((previous) => {
              const next = new Set(previous)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
            setBoardRoutes([])
          }}
          onRemoveAspect={(id) => {
            setBoard((previous) => { const next = { ...previous }; delete next[id]; return next })
            setAnchorCells((previous) => { const next = new Set(previous); next.delete(id); return next })
            setSelectedCells((previous) => previous.filter((item) => item !== id))
            setBoardRoutes([])
          }}
        />
        <div className="board-actions" aria-live="polite">
          <div className="selected-aspects">{selectedCells.length === 0 && <span>Select two aspects for a manual branch</span>}{selectedCells.map((id, index) => <div key={id}><b>{index === 0 ? 'From' : 'To'}</b><AspectIcon aspect={board[id]} /><span>{aspectLabel(board[id])}</span></div>)}</div>
          <p>{boardMessage}</p>
          <button className="magic-button" type="button" onClick={solveEntireMap}>Auto-connect all <span>✦</span></button>
          <button className="obstacle-button" type="button" onClick={() => setEditingObstacles((current) => !current)}>{editingObstacles ? 'Done editing obstacles' : 'Edit obstacles'}</button>
          <button className="manual-chain-button" type="button" onClick={buildBoardPath}>Connect selected</button>
          <button className="clear-map" type="button" onClick={() => clearBoard()}>Clear map</button>
        </div>
      </div>
    </div>
  </section>
}
