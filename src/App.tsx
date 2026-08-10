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

const defaultBoardSize = 9
const hexWidth = 46
const hexHeight = 53
const hexGap = 3
const hexColumnStep = hexWidth + hexGap
const hexRowStep = 40 + hexGap
const cellId = (row: number, column: number) => `${row}-${column}`
const parseCellId = (id: string) => id.split('-').map(Number) as [number, number]

function getBoardNeighbors(id: string, boardSize: number) {
  const [row, column] = parseCellId(id)
  const directions = row % 2 === 0
    ? [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
    : [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]

  return directions.map(([rowOffset, columnOffset]) => cellId(row + rowOffset, column + columnOffset))
    .filter((next) => {
      const [nextRow, nextColumn] = parseCellId(next)
      return nextRow >= 0 && nextRow < boardSize && nextColumn >= 0 && nextColumn < boardSize
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

function findBoardRoute(start: string, finish: string, length: number, occupied: Set<string>, boardSize: number) {
  const [startRow, startColumn] = parseCellId(start)
  const [finishRow, finishColumn] = parseCellId(finish)
  let attempts = 0

  const walk = (current: string, route: string[], visited: Set<string>): string[] | null => {
    attempts += 1
    if (attempts > 40000) return null
    if (route.length === length) return current === finish ? route : null
    const remaining = length - route.length
    const options = getBoardNeighbors(current, boardSize)
      .filter((next) => !visited.has(next) && (!occupied.has(next) || next === finish))
      .sort((a, b) => {
        const [aRow, aColumn] = parseCellId(a)
        const [bRow, bColumn] = parseCellId(b)
        return Math.max(Math.abs(aRow - finishRow), Math.abs(aColumn - finishColumn)) - Math.max(Math.abs(bRow - finishRow), Math.abs(bColumn - finishColumn))
      })

    for (const next of options) {
      if (next === finish && remaining !== 1) continue
      const nextVisited = new Set(visited)
      nextVisited.add(next)
      const result = walk(next, [...route, next], nextVisited)
      if (result) return result
    }
    return null
  }

  return walk(cellId(startRow, startColumn), [start], new Set([start]))
}

function App() {
  const [version, setVersion] = useState(latestVersion)
  const catalog = useMemo(() => getCatalog(version), [version])
  const [enabled, setEnabled] = useState<Set<string>>(() => defaultEnabled(getCatalog(latestVersion)))
  const [activeAddons, setActiveAddons] = useState<Set<string>>(() => new Set(['gt']))
  const [from, setFrom] = useState('air')
  const [to, setTo] = useState('air')
  const [minSpaces, setMinSpaces] = useState(1)
  const [result, setResult] = useState<string[] | null>(null)
  const [searched, setSearched] = useState(false)
  const [mode, setMode] = useState<Mode>('quick')
  const [board, setBoard] = useState<Record<string, string>>({})
  const [selectedCells, setSelectedCells] = useState<string[]>([])
  const [boardRoute, setBoardRoute] = useState<string[] | null>(null)
  const [boardMessage, setBoardMessage] = useState('Drag aspects onto the map, then select two of them.')
  const [obstacles, setObstacles] = useState<Set<string>>(new Set())
  const [editingObstacles, setEditingObstacles] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [boardSize, setBoardSize] = useState(defaultBoardSize)

  const changeVersion = (nextVersion: string) => {
    const nextCatalog = getCatalog(nextVersion)
    setVersion(nextVersion)
    setEnabled(defaultEnabled(nextCatalog))
    setActiveAddons(new Set(['gt']))
    setFrom('air')
    setTo('air')
    setResult(null)
    setSearched(false)
    setBoard({})
    setSelectedCells([])
    setBoardRoute(null)
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
    setSelectedCells((previous) => previous.filter((id) => id !== target))
    setBoardRoute(null)
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
    setSelectedCells((previous) => previous.map((id) => id === source ? target : id === target ? source : id))
    setBoardRoute(null)
    setBoardMessage('Aspect moved. Select endpoints or continue editing.')
  }

  const selectBoardCell = (id: string) => {
    if (!board[id]) return
    setBoardRoute(null)
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
    setBoardRoute(route)
    setSelectedCells([])
    setBoardMessage(`Chain built with ${path.length - 2} intermediate aspects.`)
  }

  const used = result ? result.slice(1, -1).reduce<Record<string, number>>((total, aspect) => ({ ...total, [aspect]: (total[aspect] ?? 0) + 1 }), {}) : {}
  const paletteAspects = catalog.aspects.filter((aspect) => enabled.has(aspect) && `${label(aspect)} ${aspect}`.toLocaleLowerCase().includes(paletteQuery.toLocaleLowerCase()))
  const changeBoardSize = (nextSize: number) => {
    setBoardSize(nextSize)
    setBoard({})
    setObstacles(new Set())
    setSelectedCells([])
    setBoardRoute(null)
    setBoardMessage(`Map resized to ${nextSize} × ${nextSize}. Place the aspects again.`)
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

      {mode === 'board' && <section className="panel research-board" aria-label="Research map"><div className="board-layout"><aside className="board-palette"><div><p className="eyebrow">Palette</p><h2>Aspects</h2></div><input value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Search aspects…" aria-label="Search aspects for the map" /><p className="palette-help">Drag an aspect onto a free cell.</p><div className="palette-list">{paletteAspects.map((aspect) => <button type="button" draggable onDragStart={(event) => event.dataTransfer.setData('text/aspect', aspect)} key={aspect}><AspectIcon aspect={aspect} /><span>{label(aspect)}</span><small>{aspect}</small></button>)}</div></aside><div className="board-main"><div className="board-title"><div className="board-title-heading"><span className="step-number">2</span><div><p className="eyebrow">Knowledge infusion</p><h2>Research map</h2></div></div><label className="board-size">Size: <strong>{boardSize} × {boardSize}</strong><input type="range" min="5" max="15" value={boardSize} onChange={(event) => changeBoardSize(Number(event.target.value))} /></label><span>{editingObstacles ? 'Click empty cells to place obstacles' : 'Select two aspects, then build the chain'}</span></div><div className="board-grid"><div className="board-grid-canvas" style={{ width: (boardSize - 1) * hexColumnStep + hexWidth + hexColumnStep / 2, height: (boardSize - 1) * hexRowStep + hexHeight }}>{boardRoute && <svg className="board-route-lines" aria-hidden="true"><polyline points={boardRoute.map((id) => { const [row, column] = parseCellId(id); return `${column * hexColumnStep + (row % 2) * hexColumnStep / 2 + hexWidth / 2},${row * hexRowStep + hexHeight / 2}` }).join(' ')} /></svg>}{Array.from({ length: boardSize * boardSize }, (_, index) => {
        const row = Math.floor(index / boardSize)
        const column = index % boardSize
        const id = cellId(row, column)
        const aspect = board[id]
        const routeIndex = boardRoute?.indexOf(id) ?? -1
        const blocked = obstacles.has(id)
        return <div key={id} style={{ left: column * hexColumnStep + (row % 2) * hexColumnStep / 2, top: row * hexRowStep }} draggable={Boolean(aspect)} onDragStart={(event) => { if (aspect) { event.dataTransfer.setData('text/aspect', aspect); event.dataTransfer.setData('text/board-cell', id) } }} className={`board-cell ${aspect ? 'has-aspect' : ''} ${blocked ? 'is-blocked' : ''} ${selectedCells.includes(id) ? 'is-selected' : ''} ${routeIndex >= 0 ? 'is-route' : ''}`} onDragOver={(event) => { if (!blocked) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/board-cell'); const dropped = event.dataTransfer.getData('text/aspect'); if (source) moveAspect(source, id); else if (dropped && !blocked) placeAspect(id, dropped) }} onClick={() => { if (editingObstacles && !aspect) { setObstacles((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next }); setBoardRoute(null) } else selectBoardCell(id) }}>{blocked ? <span className="blocked-mark">✕</span> : aspect && <>{routeIndex >= 0 && <span className="cell-order">{routeIndex + 1}</span>}<AspectIcon aspect={aspect} /><b>{label(aspect)}</b><small>{aspect}</small><button type="button" className="remove-cell" onClick={(event) => { event.stopPropagation(); setBoard((previous) => { const next = { ...previous }; delete next[id]; return next }); setSelectedCells((previous) => previous.filter((item) => item !== id)); setBoardRoute(null) }} aria-label={`Remove ${label(aspect)} from the map`}>×</button></>}</div>
      })}</div></div><div className="board-actions" aria-live="polite"><div className="selected-aspects">{selectedCells.length === 0 && <span>Select start and end aspects</span>}{selectedCells.map((id, index) => <div key={id}><b>{index === 0 ? 'From' : 'To'}</b><AspectIcon aspect={board[id]} /><span>{label(board[id])}</span></div>)}</div><p>{boardMessage}</p><button className="obstacle-button" type="button" onClick={() => setEditingObstacles((current) => !current)}>{editingObstacles ? 'Done editing obstacles' : 'Edit obstacles'}</button><button className="find-button" type="button" onClick={buildBoardPath}>Build chain <span>✦</span></button><button className="clear-map" type="button" onClick={() => { setBoard({}); setObstacles(new Set()); setSelectedCells([]); setBoardRoute(null); setBoardMessage('Map cleared. Drag new aspects onto it.') }}>Clear map</button></div></div></div></section>}

      <section className="panel inventory-panel">
        <div className="inventory-header"><div className="panel-heading"><span className="step-number">3</span><div><h2>Available aspects</h2><p>Click an aspect to exclude it from the search.</p></div></div><div className="inventory-actions"><button type="button" onClick={() => { setEnabled(new Set(catalog.aspects)); setActiveAddons(new Set(addonEntries.map(([id]) => id))) }}>Select all</button><button type="button" onClick={() => { setEnabled(new Set()); setActiveAddons(new Set()) }}>Deselect all</button></div></div>
        <div className="addons">{addonEntries.map(([id, addon]) => <label key={id}><input type="checkbox" checked={activeAddons.has(id)} onChange={() => toggleAddon(id)} /> <span>{addon.name}</span></label>)}</div>
        <div className="aspect-grid">{catalog.aspects.map((aspect) => {
          const available = enabled.has(aspect)
          const parts = catalog.combinations[aspect]
          return <button className={`aspect-card ${available ? '' : 'is-disabled'}`} type="button" key={aspect} onClick={() => setEnabled((previous) => { const next = new Set(previous); if (available) next.delete(aspect); else next.add(aspect); return next })} title={parts ? `${label(parts[0])} + ${label(parts[1])}` : 'Primal aspect'}><AspectIcon aspect={aspect} muted={!available} /><span>{label(aspect)}</span><small>{aspect}</small>{parts && <em>{parts.map(label).join(' + ')}</em>}</button>
        })}</div>
      </section>

      <footer>Data and original logic: <a href="https://github.com/ythri/tcresearch/tree/gh-pages" target="_blank" rel="noreferrer">ythri/tcresearch</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</footer>
    </main>
  )
}

export default App
