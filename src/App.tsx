import { useMemo, useState } from 'react'
import { addonDictionary } from './data/addons.js'
import { translate } from './data/aspects.js'
import { versionDictionary } from './data/versions.js'
import './App.css'

type Combinations = Record<string, [string, string]>
type VersionDefinition = { base_aspects: string[]; combinations: Combinations }
type AddonDefinition = { name: string; aspects: string[]; combinations: Combinations }
type Mode = 'quick' | 'board'

const aspectNames = translate as Record<string, string>
const versionMap = versionDictionary as unknown as Record<string, VersionDefinition>
const addonMap = addonDictionary as unknown as Record<string, AddonDefinition>

const versions = Object.keys(versionMap)
const latestVersion = '5.1.3'
const versionStorageKey = 'thaumaspects.version'
const addonEntries = Object.entries(addonMap)

function getStoredVersion() {
  if (typeof window === 'undefined') return latestVersion
  const storedVersion = window.localStorage.getItem(versionStorageKey)
  return storedVersion && storedVersion in versionMap ? storedVersion : latestVersion
}

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
  return <img className="aspect-icon" src={icon(aspect, muted)} alt="" />
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
    <button className="aspect-picker-trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}><AspectIcon aspect={value} /><span>{label(value)}</span><small>{value}</small><b aria-hidden="true">⌄</b></button>
    {open && <div className="aspect-picker-menu"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search aspects…" autoFocus aria-label={`Search aspects for ${caption}`} />
      <div className="aspect-picker-options" role="listbox">{matches.map((aspect) => <button type="button" role="option" aria-selected={aspect === value} key={aspect} onClick={() => selectAspect(aspect)}><AspectIcon aspect={aspect} /><span>{label(aspect)}</span><small>{aspect}</small></button>)}{matches.length === 0 && <p>No aspects found</p>}</div>
    </div>}
  </div>
}

function VersionSelect({ value, onChange }: { value: string; onChange: (version: string) => void }) {
  const [open, setOpen] = useState(false)

  const chooseVersion = (nextVersion: string) => {
    onChange(nextVersion)
    setOpen(false)
  }

  return <div className="field-label version-picker"><span>Thaumcraft version</span>
    <button className="version-picker-trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{value}</span><b aria-hidden="true">⌄</b></button>
    {open && <div className="version-picker-menu" role="listbox">{versions.map((item) => <button type="button" role="option" aria-selected={item === value} key={item} onClick={() => chooseVersion(item)}>{item}</button>)}</div>}
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

function findBoardRoute(start: string, finish: string, length: number, occupied: Set<string>, boardSize: number) {
  return findBoardRouteCandidates(start, finish, length, occupied, boardSize, 48)[0] ?? null
}

function App() {
  const initialVersion = getStoredVersion()
  const [version, setVersion] = useState(initialVersion)
  const catalog = useMemo(() => getCatalog(version), [version])
  const [enabled, setEnabled] = useState<Set<string>>(() => defaultEnabled(getCatalog(initialVersion)))
  const [activeAddons, setActiveAddons] = useState<Set<string>>(() => new Set(['gt']))
  const [from, setFrom] = useState('air')
  const [to, setTo] = useState('air')
  const [minSpaces, setMinSpaces] = useState(1)
  const [result, setResult] = useState<string[] | null>(null)
  const [searched, setSearched] = useState(false)
  const [mode, setMode] = useState<Mode>('quick')
  const [board, setBoard] = useState<Record<string, string>>({})
  const [anchorCells, setAnchorCells] = useState<Set<string>>(new Set())
  const [selectedCells, setSelectedCells] = useState<string[]>([])
  const [boardRoutes, setBoardRoutes] = useState<string[][]>([])
  const [boardMessage, setBoardMessage] = useState('Drag aspects onto the map, then select two of them.')
  const [obstacles, setObstacles] = useState<Set<string>>(new Set())
  const [editingObstacles, setEditingObstacles] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [boardSize, setBoardSize] = useState(defaultBoardSize)

  const changeVersion = (nextVersion: string) => {
    const nextCatalog = getCatalog(nextVersion)
    window.localStorage.setItem(versionStorageKey, nextVersion)
    setVersion(nextVersion)
    setEnabled(defaultEnabled(nextCatalog))
    setActiveAddons(new Set(['gt']))
    setFrom('air')
    setTo('air')
    setResult(null)
    setSearched(false)
    setBoard({})
    setAnchorCells(new Set())
    setSelectedCells([])
    setBoardRoutes([])
    setObstacles(new Set())
    setBoardMessage('Drag aspects onto the map, then select two of them.')
  }

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
    const path = findPath(board[start], board[finish], requiredSpaces, catalog.combinations, enabled)
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
    const anchors = [...anchorCells].filter((id) => board[id] && !obstacles.has(id))
    if (anchors.length < 2) {
      setBoardMessage('Place at least two source aspects on the map before using auto-connect.')
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
        setBoardMessage('The source aspects cannot all be connected. Remove some obstacles or move the isolated aspects.')
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
    setSelectedCells([])
    setBoardMessage(`Auto-connected ${anchors.length} source aspects with ${routes.length} optimal branches.`)
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
    setSelectedCells([])
    setBoardRoutes([])
    setBoardMessage(`Map resized to a radius of ${Math.floor(nextSize / 2)} rings. Place the aspects again.`)
  }

  return (
    <main className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Thaumcraft 4 · 5</p>
          <h1>Research Helper</h1>
          <p className="intro">Build an aspect chain for your research note and exclude aspects you have not unlocked yet.</p>
        </div>
        <div className="hero-rune" aria-hidden="true">✦</div>
      </header>

      <section className={`workspace ${mode === 'board' ? 'board-mode' : ''}`} aria-label="Aspect connection search">
        <div className="panel search-panel">
          <div className="panel-heading"><span className="step-number">1</span><div><h2>Set up your search</h2><p>Your game version and two aspects from the note.</p></div></div>
          <div className="mode-switch" role="group" aria-label="Work mode"><button type="button" className={mode === 'quick' ? 'is-active' : ''} onClick={() => setMode('quick')}>Quick search</button><button type="button" className={mode === 'board' ? 'is-active' : ''} onClick={() => setMode('board')}>Research map</button></div>
          <VersionSelect value={version} onChange={changeVersion} />
          {mode === 'quick' && <div className="aspect-selects">
            <AspectSelect caption="From" value={from} aspects={catalog.aspects} onChange={setFrom} />
            <button className="swap-aspects" type="button" onClick={() => { setFrom(to); setTo(from) }} aria-label="Swap aspects" title="Swap aspects">⇄</button>
            <AspectSelect caption="To" value={to} aspects={catalog.aspects} onChange={setTo} />
          </div>}
          <label className="field-label">Empty spaces between aspects: <strong>{minSpaces}</strong>
            <input type="range" min="1" max="10" value={minSpaces} onChange={(event) => setMinSpaces(Number(event.target.value))} />
          </label>
          {mode === 'quick' ? <button className="find-button" type="button" onClick={runSearch}>Find connection <span>→</span></button> : <div className="board-instructions"><strong>1.</strong> Drag two aspects onto the map. <strong>2.</strong> Select them. <strong>3.</strong> Build the chain.</div>}
        </div>

        {mode === 'quick' ? <aside className="panel result-panel" aria-live="polite">
          <div className="panel-heading"><span className="step-number">2</span><div><h2>Chain</h2><p>{searched ? (result ? 'Done — transfer the aspects to your note.' : 'No suitable chain was found.') : 'Your solution will appear here.'}</p></div></div>
          {result && <>
            <ol className="path-list">{result.map((aspect, index) => <li key={`${aspect}-${index}`}><div className="path-aspect"><AspectIcon aspect={aspect} /><span>{label(aspect)}</span><small>{aspect}</small></div>{index < result.length - 1 && <span className="path-arrow">↓</span>}</li>)}</ol>
            <div className="used-aspects"><span>Used: {result.length - 2} steps</span><div>{Object.entries(used).map(([aspect, count]) => <span className="used-icon" key={aspect} title={`${label(aspect)}: ${count}`}><AspectIcon aspect={aspect} />{count}</span>)}</div></div>
          </>}
          {searched && !result && <div className="empty-result">Enable more aspects or reduce the number of empty spaces.</div>}
          {!searched && <div className="empty-result">Select start and end aspects, then click “Find connection”.</div>}
        </aside> : null}
      </section>

      {mode === 'board' && <section className="panel research-board" aria-label="Research map"><div className="board-layout"><aside className="board-palette"><div><p className="eyebrow">Palette</p><h2>Aspects</h2></div><input value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Search aspects…" aria-label="Search aspects for the map" /><p className="palette-help">Drag an aspect onto a free cell.</p><div className="palette-list">{paletteAspects.map((aspect) => <button type="button" draggable onDragStart={(event) => event.dataTransfer.setData('text/aspect', aspect)} key={aspect}><AspectIcon aspect={aspect} /><span>{label(aspect)}</span><small>{aspect}</small></button>)}</div></aside><div className="board-main"><div className="board-title"><div className="board-title-heading"><span className="step-number">2</span><div><p className="eyebrow">Knowledge infusion</p><h2>Research map</h2></div></div><label className="board-size">Map radius: <strong>{Math.floor(boardSize / 2)} rings</strong><input type="range" min="2" max="7" value={Math.floor(boardSize / 2)} onChange={(event) => changeBoardSize(Number(event.target.value) * 2 + 1)} /></label><span>{editingObstacles ? 'Click empty cells to place obstacles' : 'Place source aspects, then auto-connect the map'}</span></div><div className="board-grid"><div className="board-grid-canvas" style={{ width: (boardSize - 1) * hexColumnStep + hexWidth, height: (boardSize - 1) * hexRowStep + hexHeight + hexRowStep / 2 }}>{boardRoutes.length > 0 && <svg className="board-route-lines" aria-hidden="true">{boardRoutes.map((route, index) => <polyline key={index} points={route.map((id) => { const [row, column] = parseCellId(id); return `${column * hexColumnStep + hexWidth / 2},${row * hexRowStep + (column % 2) * hexRowStep / 2 + hexHeight / 2}` }).join(' ')} />)}</svg>}{getBoardCells(boardSize).map(({ row, column }) => {
        const id = cellId(row, column)
        const aspect = board[id]
        const routeNumber = boardRouteOrder.get(id)
        const blocked = obstacles.has(id)
        return <div key={id} style={{ left: column * hexColumnStep, top: row * hexRowStep + (column % 2) * hexRowStep / 2 }} draggable={Boolean(aspect)} onDragStart={(event) => { if (aspect) { event.dataTransfer.setData('text/aspect', aspect); event.dataTransfer.setData('text/board-cell', id) } }} className={`board-cell ${aspect ? 'has-aspect' : ''} ${anchorCells.has(id) ? 'is-anchor' : ''} ${blocked ? 'is-blocked' : ''} ${selectedCells.includes(id) ? 'is-selected' : ''} ${routeNumber !== undefined ? 'is-route' : ''}`} onDragOver={(event) => { if (!blocked) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/board-cell'); const dropped = event.dataTransfer.getData('text/aspect'); if (source) moveAspect(source, id); else if (dropped && !blocked) placeAspect(id, dropped) }} onClick={() => { if (editingObstacles && !aspect) { setObstacles((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next }); setBoardRoutes([]) } else selectBoardCell(id) }}>{blocked ? <span className="blocked-mark">✕</span> : aspect && <>{routeNumber !== undefined && <span className="cell-order">{routeNumber}</span>}<AspectIcon aspect={aspect} /><b>{label(aspect)}</b><small>{aspect}</small><button type="button" className="remove-cell" onClick={(event) => { event.stopPropagation(); setBoard((previous) => { const next = { ...previous }; delete next[id]; return next }); setAnchorCells((previous) => { const next = new Set(previous); next.delete(id); return next }); setSelectedCells((previous) => previous.filter((item) => item !== id)); setBoardRoutes([]) }} aria-label={`Remove ${label(aspect)} from the map`}>×</button></>}</div>
      })}</div></div><div className="board-actions" aria-live="polite"><div className="selected-aspects">{selectedCells.length === 0 && <span>Select two aspects for a manual branch</span>}{selectedCells.map((id, index) => <div key={id}><b>{index === 0 ? 'From' : 'To'}</b><AspectIcon aspect={board[id]} /><span>{label(board[id])}</span></div>)}</div><p>{boardMessage}</p><button className="magic-button" type="button" onClick={solveEntireMap}>Auto-connect all <span>✦</span></button><button className="obstacle-button" type="button" onClick={() => setEditingObstacles((current) => !current)}>{editingObstacles ? 'Done editing obstacles' : 'Edit obstacles'}</button><button className="manual-chain-button" type="button" onClick={buildBoardPath}>Connect selected</button><button className="clear-map" type="button" onClick={() => { setBoard({}); setAnchorCells(new Set()); setObstacles(new Set()); setSelectedCells([]); setBoardRoutes([]); setBoardMessage('Map cleared. Drag new aspects onto it.') }}>Clear map</button></div></div></div></section>}

      <section className="panel inventory-panel">
        <div className="inventory-header"><div className="panel-heading"><span className="step-number">3</span><div><h2>Available aspects</h2><p>Click an aspect to exclude it from the search.</p></div></div><div className="inventory-actions"><button type="button" onClick={() => { setEnabled(new Set(catalog.aspects)); setActiveAddons(new Set(addonEntries.map(([id]) => id))) }}>Select all</button><button type="button" onClick={() => { setEnabled(new Set()); setActiveAddons(new Set()) }}>Deselect all</button></div></div>
        <div className="addons">{addonEntries.map(([id, addon]) => <label key={id}><input type="checkbox" checked={activeAddons.has(id)} onChange={() => toggleAddon(id)} /> <span>{addon.name}</span></label>)}</div>
        <div className="aspect-grid">{catalog.aspects.map((aspect) => {
          const available = enabled.has(aspect)
          const parts = catalog.combinations[aspect]
          return <button className={`aspect-card ${available ? '' : 'is-disabled'}`} type="button" key={aspect} onClick={() => setEnabled((previous) => { const next = new Set(previous); if (available) next.delete(aspect); else next.add(aspect); return next })} title={parts ? `${label(parts[0])} + ${label(parts[1])}` : 'Primal aspect'}><AspectIcon aspect={aspect} muted={!available} /><span>{label(aspect)}</span><small>{aspect}</small>{parts && <em>{parts.map(label).join(' + ')}</em>}</button>
        })}</div>
      </section>

      <footer>Data and original logic: <a href="https://github.com/ythri/tcresearch/tree/gh-pages" target="_blank" rel="noreferrer">ythri/tcresearch</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Source code: <a href="https://github.com/yovengo/thaumaspects" target="_blank" rel="noreferrer">GitHub</a>.</footer>
    </main>
  )
}

export default App
