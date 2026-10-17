'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { addonDictionary } from './data/addons.js'
import { translate } from './data/aspects.js'
import { versionDictionary } from './data/versions.js'
import EssentiaPlanner from './components/EssentiaPlanner'

type Combinations = Record<string, [string, string]>
type VersionDefinition = { base_aspects: string[]; combinations: Combinations }
type AddonDefinition = { name: string; aspects: string[]; combinations: Combinations }
type Mode = 'quick' | 'board'

const aspectNames = translate as Record<string, string>
const versionMap = versionDictionary as unknown as Record<string, VersionDefinition>
const addonMap = addonDictionary as unknown as Record<string, AddonDefinition>

const latestVersion = '5.1.3'
const addonEntries = Object.entries(addonMap)

const label = (aspect: string) => `${aspectNames[aspect] ?? aspect}`.replace(/^./, (letter) => letter.toUpperCase())
const icon = (aspect: string, muted = false) => `/aspects/${muted ? 'mono' : 'color'}/${aspectNames[aspect]}.png`

const defaultEnabled = (catalog: ReturnType<typeof getCatalog>) => new Set(catalog.aspects.filter((aspect) => !catalog.addonAspects.includes(aspect) || addonMap.gt.aspects.includes(aspect)))

function getCatalog(version: string) {
  const definition = versionMap[version]
  const combinations: Combinations = { ...definition.combinations }
  const addonAspects: string[] = []

  addonEntries.forEach(([, addon]) => {
    Object.assign(combinations, addon.combinations)
    addonAspects.push(...addon.aspects)
  })

  return {
    combinations,
    addonAspects,
    aspects: [...new Set([...definition.base_aspects, ...Object.keys(definition.combinations), ...addonAspects])].sort((a, b) => label(a).localeCompare(label(b))),
  }
}

function findPath(from: string, to: string, minSpaces: number, combinations: Combinations, enabled: Set<string>) {
  const graph: Record<string, string[]> = {}
  const connect = (a: string, b: string) => {
    ;(graph[a] ??= []).push(b)
    ;(graph[b] ??= []).push(a)
  }
  Object.entries(combinations).forEach(([compound, parts]) => {
    connect(compound, parts[0])
    connect(compound, parts[1])
  })

  const queue: { path: string[]; cost: number }[] = [{ path: [from], cost: 0 }]
  const visited = new Map<string, Set<number>>()

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost)
    const current = queue.shift()!
    const node = current.path[current.path.length - 1]
    const edges = current.path.length - 1
    const depths = visited.get(node) ?? new Set<number>()
    if (depths.has(edges)) continue
    depths.add(edges)
    visited.set(node, depths)

    if (node === to && current.path.length > minSpaces + 1) return current.path
    for (const next of graph[node] ?? []) {
      queue.push({
        path: [...current.path, next],
        cost: current.cost + (enabled.has(next) ? 1 : 100) + (current.path.includes(next) ? 8 : 0),
      })
    }
  }
  return null
}

function AspectIcon({ aspect, muted = false }: { aspect: string; muted?: boolean }) {
  return <Image className="aspect-icon" src={icon(aspect, muted)} width={26} height={26} alt="" />
}

function WandIcon() {
  return <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20 15.5 8.5" stroke="#4b3340" strokeWidth="3.2" /><path d="M4 20 15.5 8.5" stroke="#916b55" strokeWidth="1.3" /><path d="m17 1.7 1.25 3.55L21.8 6.5l-3.55 1.25L17 11.3l-1.25-3.55L12.2 6.5l3.55-1.25L17 1.7Z" fill="#fff1c7" stroke="#5d3f3b" strokeWidth=".8" /><path d="M9 2.2v2.4M7.8 3.4h2.4M21 12v1.8M20.1 12.9h1.8" stroke="#5d3f3b" strokeWidth="1.2" /></svg>
}

function BroomIcon() {
  return <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2v11" stroke="#b58b62" strokeWidth="2.6" /><path d="M9 12h6v3H9z" fill="#9a774f" stroke="#e9d5a7" strokeWidth=".8" /><path d="m9 15-4 6.5c4.5 1.4 9.5 1.4 14 0L15 15H9Z" fill="#d5b77f" stroke="#e9d5a7" strokeWidth=".8" /><path d="m9 16-2 5M12 16v6M15 16l2 5" stroke="#886846" strokeWidth="1" /></svg>
}

function AspectSelect({ caption, value, aspects, onChange }: { caption: string; value: string; aspects: string[]; onChange: (aspect: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const matches = aspects.filter((aspect) => `${label(aspect)} ${aspect}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))

  const selectAspect = (aspect: string) => {
    onChange(aspect)
    setOpen(false)
    setQuery('')
  }

  return <div className="field-label aspect-picker"><span>{caption}</span>
    <button className="aspect-picker-trigger" type="button" aria-label={`Choose ${caption.toLowerCase()} aspect, currently ${label(value)}`} aria-expanded={open} onClick={() => setOpen((current) => !current)}><AspectIcon aspect={value} /><span>{label(value)}</span><small>{value}</small><b aria-hidden="true">⌄</b></button>
    {open && <div className="aspect-picker-menu"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && matches[0]) selectAspect(matches[0]) }} placeholder="Search aspects…" autoFocus aria-label={`Search aspects for ${caption}`} />
      <div className="aspect-picker-options" role="listbox">{matches.map((aspect) => <button type="button" role="option" aria-selected={aspect === value} key={aspect} onClick={() => selectAspect(aspect)}><AspectIcon aspect={aspect} /><span>{label(aspect)}</span><small>{aspect}</small></button>)}{matches.length === 0 && <p>No aspects found</p>}</div>
    </div>}
  </div>
}

const defaultBoardSize = 7
const hexWidth = 61
const hexHeight = 53
const hexGap = 6
const hexColumnStep = 46 + hexGap
const hexRowStep = hexHeight + hexGap
const cellId = (row: number, column: number) => `${row}-${column}`
const parseCellId = (id: string) => id.split('-').map(Number) as [number, number]

function isBoardCell(row: number, column: number, boardSize: number) {
  const radius = Math.floor(boardSize / 2)
  const centerAxialRow = radius - Math.floor((radius - (radius & 1)) / 2)
  const axialColumn = column - radius
  const axialRow = row - Math.floor((column - (column & 1)) / 2) - centerAxialRow
  return Math.max(Math.abs(axialColumn), Math.abs(axialRow), Math.abs(-axialColumn - axialRow)) <= radius
}

function getBoardCells(boardSize: number) {
  return Array.from({ length: boardSize * boardSize }, (_, index) => ({
    row: Math.floor(index / boardSize),
    column: index % boardSize,
  })).filter(({ row, column }) => isBoardCell(row, column, boardSize))
}

function getBoardNeighbors(id: string, boardSize: number) {
  const [row, column] = parseCellId(id)
  const directions = column % 2 === 0
    ? [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]
    : [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]

  return directions.map(([rowOffset, columnOffset]) => cellId(row + rowOffset, column + columnOffset))
    .filter((next) => {
      const [nextRow, nextColumn] = parseCellId(next)
      return nextRow >= 0 && nextRow < boardSize && nextColumn >= 0 && nextColumn < boardSize && isBoardCell(nextRow, nextColumn, boardSize)
    })
}

function findShortestBoardRoute(start: string, finish: string, occupied: Set<string>, boardSize: number) {
  const queue: string[][] = [[start]]
  const visited = new Set([start])

  while (queue.length) {
    const route = queue.shift()!
    const current = route[route.length - 1]
    if (current === finish) return route
    for (const next of getBoardNeighbors(current, boardSize)) {
      if (visited.has(next) || (occupied.has(next) && next !== finish)) continue
      visited.add(next)
      queue.push([...route, next])
    }
  }
  return null
}

function toCube(id: string) {
  const [row, column] = parseCellId(id)
  const x = column
  const z = row - Math.floor((column - (column & 1)) / 2)
  return [x, -x - z, z]
}

function boardDistance(from: string, to: string) {
  const a = toCube(from)
  const b = toCube(to)
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}

function routeTurns(route: string[]) {
  let turns = 0
  for (let index = 2; index < route.length; index += 1) {
    const previous = toCube(route[index - 2])
    const current = toCube(route[index - 1])
    const next = toCube(route[index])
    const firstDirection = current.map((value, axis) => value - previous[axis]).join(',')
    const secondDirection = next.map((value, axis) => value - current[axis]).join(',')
    if (firstDirection !== secondDirection) turns += 1
  }
  return turns
}

function findBoardRouteCandidates(start: string, finish: string, length: number, occupied: Set<string>, boardSize: number, limit = 32) {
  let attempts = 0
  const candidates: string[][] = []

  const walk = (current: string, route: string[], visited: Set<string>) => {
    attempts += 1
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

function App({ page }: { page: 'board' | 'essentia' }) {
  const catalog = useMemo(() => getCatalog(latestVersion), [])
  const [enabled, setEnabled] = useState<Set<string>>(() => defaultEnabled(getCatalog(latestVersion)))
  const [activeAddons, setActiveAddons] = useState<Set<string>>(() => new Set(['gt']))
  const [from, setFrom] = useState('air')
  const [to, setTo] = useState('air')
  const [minSpaces, setMinSpaces] = useState(1)
  const [result, setResult] = useState<string[] | null>(null)
  const [searched, setSearched] = useState(false)
  const [mode, setMode] = useState<Mode>('board')
  const [board, setBoard] = useState<Record<string, string>>({})
  const [anchorCells, setAnchorCells] = useState<Set<string>>(new Set())
  const [boardRoutes, setBoardRoutes] = useState<string[][]>([])
  const [boardMessage, setBoardMessage] = useState('')
  const [obstacles, setObstacles] = useState<Set<string>>(new Set())
  const [aspectsOpen, setAspectsOpen] = useState(false)
  const dragRef = useRef(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [pendingAspect, setPendingAspect] = useState<string | null>(null)
  const [boardSize, setBoardSize] = useState(defaultBoardSize)

  const toggleAddon = (id: string) => {
    const addon = addonMap[id]
    const active = activeAddons.has(id)
    setActiveAddons((previous) => {
      const next = new Set(previous)
      if (active) next.delete(id)
      else next.add(id)
      return next
    })
    setEnabled((previous) => {
      const next = new Set(previous)
      addon.aspects.forEach((aspect) => {
        if (active) next.delete(aspect)
        else next.add(aspect)
      })
      return next
    })
  }

  const runSearch = () => {
    setResult(findPath(from, to, minSpaces, catalog.combinations, enabled))
    setSearched(true)
  }

  const placeAspect = (target: string, aspect: string) => {
    setBoard((previous) => ({ ...previous, [target]: aspect }))
    setPendingAspect(null)
    setAnchorCells((previous) => new Set(previous).add(target))
    setBoardRoutes([])
    setBoardMessage('Aspect placed.')
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
    setBoardRoutes([])
    setBoardMessage('Aspect moved.')
  }

  const solveEntireMap = () => {
    const anchors = [...anchorCells].filter((id) => board[id] && !obstacles.has(id))
    if (anchors.length < 2) {
      setBoardMessage('Place two aspects first.')
      return
    }

    const workingBoard = Object.fromEntries(anchors.map((id) => [id, board[id]])) as Record<string, string>
    const connected = new Set<string>([anchors[0]])
    const remaining = new Set(anchors.slice(1))
    const routes: string[][] = []

    while (remaining.size) {
      let best: { target: string; route: string[]; aspects: string[]; score: number } | null = null

      for (const target of remaining) {
        for (const source of connected) {
          const occupied = new Set([...Object.keys(workingBoard).filter((id) => id !== source && id !== target), ...obstacles])
          const shortestRoute = findShortestBoardRoute(source, target, occupied, boardSize)
          if (!shortestRoute) continue

          for (let extraSpaces = 0; extraSpaces <= 2; extraSpaces += 1) {
            const aspectPath = findPath(workingBoard[source], workingBoard[target], Math.max(0, shortestRoute.length - 2 + extraSpaces), catalog.combinations, enabled)
            if (!aspectPath) continue
            const routeCandidates = findBoardRouteCandidates(source, target, aspectPath.length, occupied, boardSize, 12)

            for (const route of routeCandidates) {
              const futureNetwork = new Set([...connected, ...route])
              const occupiedAfterRoute = new Set([...occupied, ...route.filter((id) => id !== target)])
              let futurePenalty = 0

              for (const futureTarget of remaining) {
                if (futureTarget === target) continue
                const distanceToNetwork = Math.min(...[...futureNetwork].map((id) => boardDistance(id, futureTarget)))
                const hasExit = getBoardNeighbors(futureTarget, boardSize).some((id) => !occupiedAfterRoute.has(id) || futureNetwork.has(id))
                futurePenalty += distanceToNetwork * 3 + (hasExit ? 0 : 100000)
              }

              const score = route.length * 1000 + routeTurns(route) * 12 + futurePenalty
              if (!best || score < best.score) best = { target, route, aspects: aspectPath, score }
            }
          }
        }
      }

      if (!best) {
        setBoardMessage('Could not connect all aspects.')
        return
      }

      best.route.forEach((id, index) => {
        workingBoard[id] = best.aspects[index]
        connected.add(id)
      })
      remaining.delete(best.target)
      routes.push(best.route)
    }

    setBoard(workingBoard)
    setBoardRoutes(routes)
    setBoardMessage(`${anchors.length} aspects connected.`)
  }

  const used = result ? result.slice(1, -1).reduce<Record<string, number>>((total, aspect) => ({ ...total, [aspect]: (total[aspect] ?? 0) + 1 }), {}) : {}
  const paletteAspects = catalog.aspects.filter((aspect) => enabled.has(aspect) && `${label(aspect)} ${aspect}`.toLocaleLowerCase().includes(paletteQuery.toLocaleLowerCase()))
  const boardRouteOrder = useMemo(() => {
    const order = new Map<string, number>()
    boardRoutes.forEach((route) => route.forEach((id) => {
      if (!order.has(id)) order.set(id, order.size + 1)
    }))
    return order
  }, [boardRoutes])
  const changeBoardSize = (nextSize: number) => {
    setBoardSize(nextSize)
    setBoard({})
    setAnchorCells(new Set())
    setObstacles(new Set())
    setBoardRoutes([])
    setBoardMessage(`Radius: ${Math.floor(nextSize / 2)} rings.`)
  }

  const toggleObstacle = (id: string) => {
    setObstacles((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setBoardRoutes([])
    setBoardMessage(obstacles.has(id) ? 'Cell open.' : 'Cell blocked.')
  }
  const unavailableCount = catalog.aspects.length - enabled.size
  const boardCanvasHeight = (boardSize - 1) * hexRowStep + hexHeight + hexRowStep / 2
  const boardMapHeight = Math.max(420, Math.ceil(boardCanvasHeight + 38))

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">✦</div>
        <div className="brand-copy"><strong>Thaumaspects</strong></div>
        <nav className="primary-nav" aria-label="Main tools">
          <Link href="/" className={page === 'board' ? 'is-active' : ''} aria-current={page === 'board' ? 'page' : undefined}><span aria-hidden="true">⬡</span> Research Map</Link>
          <Link href="/essentia" className={page === 'essentia' ? 'is-active' : ''} aria-current={page === 'essentia' ? 'page' : undefined}><span aria-hidden="true">✧</span> Essentia Planner</Link>
        </nav>
        <span className="site-version">GTNH 2.9.0-beta-2</span>
      </header>

      {page === 'essentia' && <EssentiaPlanner />}

      {page === 'board' && <>
        <div className="page-heading">
          <h1>{mode === 'quick' ? 'Quick Search' : 'Research Map'}</h1>
          <button className="secondary-link" type="button" onClick={() => setMode(mode === 'quick' ? 'board' : 'quick')}>{mode === 'quick' ? '← Back to map' : 'Quick Search ↗'}</button>
        </div>

        {mode === 'quick' && <section className="quick-layout" aria-label="Quick aspect search">
          <div className="panel quick-form"><div className="section-heading"><h2>Connection</h2></div>
            <div className="aspect-selects"><AspectSelect caption="From" value={from} aspects={catalog.aspects} onChange={setFrom} /><button className="swap-aspects" type="button" onClick={() => { setFrom(to); setTo(from) }} aria-label="Swap aspects" title="Swap aspects">⇄</button><AspectSelect caption="To" value={to} aspects={catalog.aspects} onChange={setTo} /></div>
            <label className="field-label">Empty spaces <strong>{minSpaces}</strong><input type="range" min="1" max="10" value={minSpaces} onChange={(event) => setMinSpaces(Number(event.target.value))} /></label>
            <button className="primary-button" type="button" onClick={runSearch}>Find connection <span aria-hidden="true">→</span></button>
          </div>
          <aside className="panel quick-result" aria-live="polite"><div className="section-heading"><h2>Chain</h2></div>
            {result && <><ol className="path-list">{result.map((aspect, index) => <li key={`${aspect}-${index}`}><div className="path-aspect"><AspectIcon aspect={aspect} /><span>{label(aspect)}</span><small>{aspect}</small></div>{index < result.length - 1 && <span className="path-arrow">↓</span>}</li>)}</ol><div className="used-aspects"><span>{result.length - 2} intermediate {result.length === 3 ? 'aspect' : 'aspects'}</span><div>{Object.entries(used).map(([aspect, count]) => <span className="used-icon" key={aspect} title={`${label(aspect)}: ${count}`}><AspectIcon aspect={aspect} /><span className="used-count">{count}</span></span>)}</div></div></>}
            {!result && <div className="empty-result">{searched ? 'No chain found.' : 'No chain yet.'}</div>}
          </aside>
        </section>}

        {mode === 'board' && <>
          <section className="panel research-board" aria-label="Research map">
            <div className="board-toolbar">
              <div className="board-radius" role="group" aria-label="Map radius"><span>Rings</span><div className="board-radius-stepper"><button type="button" aria-label="Decrease map radius" disabled={boardSize <= 5} onClick={() => changeBoardSize(boardSize - 2)}>−</button><output aria-live="polite">{Math.floor(boardSize / 2)}</output><button type="button" aria-label="Increase map radius" disabled={boardSize >= 15} onClick={() => changeBoardSize(boardSize + 2)}>+</button></div></div>
              <p className="board-status" role="status">{boardMessage}</p>
              <div className="board-action-buttons"><button className="primary-button board-auto-button" type="button" aria-label="Auto-connect all" onClick={solveEntireMap}><WandIcon /><span className="board-auto-label-full">Auto-connect all</span><span className="board-auto-label-short">Connect all</span></button><button className="quiet-button board-clear-button" type="button" aria-label="Clear map" title="Clear map" onClick={() => { setBoard({}); setAnchorCells(new Set()); setObstacles(new Set()); setBoardRoutes([]); setBoardMessage('') }}><BroomIcon /></button></div>
            </div>
            <div className="board-layout" style={{ '--board-map-height': `${boardMapHeight}px` } as CSSProperties}><aside className="board-palette"><div className="palette-heading"><strong>{pendingAspect ? `${label(pendingAspect)} selected` : 'Aspects'}</strong></div><input value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Search aspects…" aria-label="Search map aspects" /><div className="palette-list">{paletteAspects.map((aspect) => <button type="button" className={pendingAspect === aspect ? 'is-active' : ''} aria-pressed={pendingAspect === aspect} draggable onDragStart={(event) => { dragRef.current = true; event.dataTransfer.setData('text/aspect', aspect) }} onDragEnd={() => window.setTimeout(() => { dragRef.current = false }, 0)} onClick={() => setPendingAspect(aspect)} key={aspect}><AspectIcon aspect={aspect} /><span>{label(aspect)}</span><small>{aspect}</small></button>)}{paletteAspects.length === 0 && <p className="palette-empty">No aspects found.</p>}</div></aside>
              <div className="board-main"><div className="board-grid"><div className="board-grid-canvas" style={{ width: (boardSize - 1) * hexColumnStep + hexWidth, height: boardCanvasHeight }}>{boardRoutes.length > 0 && <svg className="board-route-lines" aria-hidden="true">{boardRoutes.map((route, index) => <polyline key={index} points={route.map((id) => { const [row, column] = parseCellId(id); return `${column * hexColumnStep + hexWidth / 2},${row * hexRowStep + (column % 2) * hexRowStep / 2 + hexHeight / 2}` }).join(' ')} />)}</svg>}{getBoardCells(boardSize).map(({ row, column }) => {
                const id = cellId(row, column)
                const aspect = board[id]
                const routeNumber = boardRouteOrder.get(id)
                const blocked = obstacles.has(id)
                const activateCell = () => {
                  if (dragRef.current) return
                  if (pendingAspect && !blocked) { placeAspect(id, pendingAspect); setPendingAspect(null) }
                  else toggleObstacle(id)
                }
                return <div key={id} role={aspect ? 'group' : 'button'} tabIndex={0} aria-label={aspect ? `${label(aspect)} on cell ${id}` : `Cell ${id}, ${blocked ? 'blocked' : 'open'}`} aria-pressed={aspect ? undefined : blocked} style={{ left: column * hexColumnStep, top: row * hexRowStep + (column % 2) * hexRowStep / 2 }} draggable={Boolean(aspect)} onDragStart={(event) => { if (aspect) { dragRef.current = true; event.dataTransfer.setData('text/aspect', aspect); event.dataTransfer.setData('text/board-cell', id) } }} onDragEnd={() => window.setTimeout(() => { dragRef.current = false }, 0)} className={`board-cell ${aspect ? 'has-aspect' : ''} ${anchorCells.has(id) ? 'is-anchor' : ''} ${blocked ? 'is-blocked' : ''} ${routeNumber !== undefined ? 'is-route' : ''}`} onDragOver={(event) => { if (!blocked) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); dragRef.current = true; const source = event.dataTransfer.getData('text/board-cell'); const dropped = event.dataTransfer.getData('text/aspect'); if (source) moveAspect(source, id); else if (dropped && !blocked) placeAspect(id, dropped); window.setTimeout(() => { dragRef.current = false }, 0) }} onClick={aspect ? undefined : activateCell} onKeyDown={(event) => { if (!aspect && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); activateCell() } }}>{blocked ? <span className="blocked-mark" aria-hidden="true">×</span> : aspect && <>{routeNumber !== undefined && <span className="cell-order">{routeNumber}</span>}<AspectIcon aspect={aspect} /><b>{label(aspect)}</b><small>{aspect}</small><button type="button" className="remove-cell" onClick={(event) => { event.stopPropagation(); setBoard((previous) => { const next = { ...previous }; delete next[id]; return next }); setAnchorCells((previous) => { const next = new Set(previous); next.delete(id); return next }); setBoardRoutes([]) }} aria-label={`Remove ${label(aspect)} from the map`}>×</button></>}</div>
              })}</div></div>
              </div></div>
          </section>
        </>}

        <section className="panel aspect-settings"><button className="settings-toggle" type="button" aria-expanded={aspectsOpen} onClick={() => setAspectsOpen((current) => !current)}><span><span className="settings-icon" aria-hidden="true">⚙</span><strong>Available Aspects</strong>{unavailableCount > 0 && <small>{unavailableCount} excluded</small>}</span><span aria-hidden="true">{aspectsOpen ? '−' : '+'}</span></button>{aspectsOpen && <div className="settings-content"><div className="inventory-header"><div className="inventory-actions"><button type="button" onClick={() => { setEnabled(new Set(catalog.aspects)); setActiveAddons(new Set(addonEntries.map(([id]) => id))) }}>Select all</button><button type="button" onClick={() => { setEnabled(new Set()); setActiveAddons(new Set()) }}>Deselect all</button></div></div><div className="addons">{addonEntries.map(([id, addon]) => <label key={id}><input type="checkbox" checked={activeAddons.has(id)} onChange={() => toggleAddon(id)} /> <span>{addon.name}</span></label>)}</div><div className="aspect-grid">{catalog.aspects.map((aspect) => { const available = enabled.has(aspect); const parts = catalog.combinations[aspect]; return <button className={`aspect-card ${available ? '' : 'is-disabled'}`} type="button" aria-pressed={available} key={aspect} onClick={() => setEnabled((previous) => { const next = new Set(previous); if (available) next.delete(aspect); else next.add(aspect); return next })} title={parts ? `${label(parts[0])} + ${label(parts[1])}` : 'Primal aspect'}><AspectIcon aspect={aspect} muted={!available} /><span>{label(aspect)}</span><small>{aspect}</small>{parts && <em>{parts.map(label).join(' + ')}</em>}</button> })}</div></div>}</section>
      </>}

      <footer><a href="https://github.com/ythri/tcresearch/tree/gh-pages" target="_blank" rel="noreferrer">ythri/tcresearch</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · <a href="https://github.com/yovengo/thaumaspects" target="_blank" rel="noreferrer">Source code</a></footer>
    </main>
  )
}

export default App
