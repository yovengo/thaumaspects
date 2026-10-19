'use client'

import Image from 'next/image'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  cellId,
  defaultBoardSize,
  getBoardCells,
  hexColumnStep,
  hexHeight,
  hexRowStep,
  hexWidth,
  maximumBoardSize,
  minimumBoardSize,
  parseCellId,
} from '@/features/research-map/boardGeometry'
import {
  type BoardSearchProgress,
  type SolvedBoard,
  solveAllAnchors,
} from '@/features/research-map/boardSolver'
import type { SolveRequest, SolveResponse } from '@/features/research-map/boardSolver.worker'
import { findAspectPath } from './model/aspectGraph'
import {
  addonEntries,
  addonMap,
  getCatalog,
  aspectIconUrl as icon,
  aspectLabel as label,
} from './model/catalog'

type Mode = 'quick' | 'board'
type ResearchSession = {
  enabled: string[]
  activeAddons: string[]
  from: string
  to: string
  minSpaces: number
  result: string[] | null
  searched: boolean
  mode: Mode
  board: Record<string, string>
  anchorCells: string[]
  boardRoutes: string[][]
  boardMessage: string
  obstacles: string[]
  aspectsOpen: boolean
  paletteQuery: string
  pendingAspect: string | null
  boardSize: number
}

const researchSessionKey = 'thaumaspects:research-session:v1'
let researchSessionCache: ResearchSession | null = null

function readResearchSession(): ResearchSession | null {
  try {
    const raw = window.sessionStorage.getItem(researchSessionKey)
    if (!raw) return null
    const saved = JSON.parse(raw) as ResearchSession
    if (
      !Array.isArray(saved.enabled) ||
      !Array.isArray(saved.activeAddons) ||
      !Array.isArray(saved.anchorCells) ||
      !Array.isArray(saved.boardRoutes) ||
      !Array.isArray(saved.obstacles) ||
      !saved.board ||
      typeof saved.board !== 'object' ||
      !Number.isInteger(saved.boardSize)
    )
      return null
    return saved
  } catch {
    return null
  }
}

const researchCatalog = getCatalog()

function AspectIcon({ aspect, muted = false }: { aspect: string; muted?: boolean }) {
  return (
    <Image
      className={`aspect-icon${aspect === 'constellation' ? ' is-astrum' : ''}`}
      src={icon(aspect, muted)}
      width={26}
      height={26}
      alt=""
    />
  )
}

function WandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20 15.5 8.5" stroke="#4b3340" strokeWidth="3.2" />
      <path d="M4 20 15.5 8.5" stroke="#916b55" strokeWidth="1.3" />
      <path
        d="m17 1.7 1.25 3.55L21.8 6.5l-3.55 1.25L17 11.3l-1.25-3.55L12.2 6.5l3.55-1.25L17 1.7Z"
        fill="#fff1c7"
        stroke="#5d3f3b"
        strokeWidth=".8"
      />
      <path d="M9 2.2v2.4M7.8 3.4h2.4M21 12v1.8M20.1 12.9h1.8" stroke="#5d3f3b" strokeWidth="1.2" />
    </svg>
  )
}

function BroomIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v11" stroke="#b58b62" strokeWidth="2.6" />
      <path d="M9 12h6v3H9z" fill="#9a774f" stroke="#e9d5a7" strokeWidth=".8" />
      <path
        d="m9 15-4 6.5c4.5 1.4 9.5 1.4 14 0L15 15H9Z"
        fill="#d5b77f"
        stroke="#e9d5a7"
        strokeWidth=".8"
      />
      <path d="m9 16-2 5M12 16v6M15 16l2 5" stroke="#886846" strokeWidth="1" />
    </svg>
  )
}

function AspectSelect({
  caption,
  value,
  aspects,
  onChange,
}: {
  caption: string
  value: string
  aspects: string[]
  onChange: (aspect: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])
  const matches = aspects.filter((aspect) =>
    `${label(aspect)} ${aspect}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  )

  const selectAspect = (aspect: string) => {
    onChange(aspect)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="field-label aspect-picker">
      <span>{caption}</span>
      <button
        className="aspect-picker-trigger"
        type="button"
        aria-label={`Choose ${caption.toLowerCase()} aspect, currently ${label(value)}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <AspectIcon aspect={value} />
        <span>{label(value)}</span>
        <small>{value}</small>
        <b aria-hidden="true">⌄</b>
      </button>
      {open && (
        <div className="aspect-picker-menu">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'Enter' && matches[0]) selectAspect(matches[0])
            }}
            placeholder="Search aspects…"
            aria-label={`Search aspects for ${caption}`}
          />
          <div className="aspect-picker-options" role="listbox">
            {matches.map((aspect) => (
              <button
                type="button"
                role="option"
                aria-selected={aspect === value}
                key={aspect}
                onClick={() => selectAspect(aspect)}
              >
                <AspectIcon aspect={aspect} />
                <span>{label(aspect)}</span>
                <small>{aspect}</small>
              </button>
            ))}
            {matches.length === 0 && <p>No aspects found</p>}
          </div>
        </div>
      )}
    </div>
  )
}

const routePoints = (route: string[]) =>
  route
    .map((id) => {
      const [row, column] = parseCellId(id)
      return `${column * hexColumnStep + hexWidth / 2},${row * hexRowStep + ((column % 2) * hexRowStep) / 2 + hexHeight / 2}`
    })
    .join(' ')

export default function ResearchMap() {
  const catalog = researchCatalog
  const initialSession = useRef(typeof window !== 'undefined' ? researchSessionCache : null)
  const [sessionReady, setSessionReady] = useState(Boolean(initialSession.current))
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(initialSession.current?.enabled ?? researchCatalog.aspects),
  )
  const [activeAddons, setActiveAddons] = useState<Set<string>>(
    () => new Set(initialSession.current?.activeAddons ?? addonEntries.map(([id]) => id)),
  )
  const [from, setFrom] = useState(initialSession.current?.from ?? 'air')
  const [to, setTo] = useState(initialSession.current?.to ?? 'air')
  const [minSpaces, setMinSpaces] = useState(initialSession.current?.minSpaces ?? 1)
  const [result, setResult] = useState<string[] | null>(initialSession.current?.result ?? null)
  const [searched, setSearched] = useState(initialSession.current?.searched ?? false)
  const [mode, setMode] = useState<Mode>(initialSession.current?.mode ?? 'board')
  const [board, setBoard] = useState<Record<string, string>>(initialSession.current?.board ?? {})
  const [anchorCells, setAnchorCells] = useState<Set<string>>(
    () => new Set(initialSession.current?.anchorCells ?? []),
  )
  const [boardRoutes, setBoardRoutes] = useState<string[][]>(
    initialSession.current?.boardRoutes ?? [],
  )
  const [boardMessage, setBoardMessage] = useState(initialSession.current?.boardMessage ?? '')
  const [obstacles, setObstacles] = useState<Set<string>>(
    () => new Set(initialSession.current?.obstacles ?? []),
  )
  const [aspectsOpen, setAspectsOpen] = useState(initialSession.current?.aspectsOpen ?? false)
  const dragRef = useRef(false)
  const [paletteQuery, setPaletteQuery] = useState(initialSession.current?.paletteQuery ?? '')
  const [pendingAspect, setPendingAspect] = useState<string | null>(
    initialSession.current?.pendingAspect ?? null,
  )
  const [boardSize, setBoardSize] = useState(initialSession.current?.boardSize ?? defaultBoardSize)
  const [solvePhase, setSolvePhase] = useState<'idle' | 'searching' | 'revealing'>('idle')
  const [searchTrace, setSearchTrace] = useState<BoardSearchProgress | null>(null)
  const [revealCell, setRevealCell] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const revealFrameRef = useRef<number | null>(null)
  const solveTokenRef = useRef(0)
  const previousViewRef = useRef<{ board: Record<string, string>; routes: string[][] } | null>(null)
  const finalBoardRef = useRef<{ result: SolvedBoard; anchorCount: number } | null>(null)

  useEffect(() => {
    if (sessionReady) return
    const saved = readResearchSession()
    if (saved) {
      setEnabled(new Set(saved.enabled))
      setActiveAddons(new Set(saved.activeAddons))
      setFrom(saved.from)
      setTo(saved.to)
      setMinSpaces(saved.minSpaces)
      setResult(saved.result)
      setSearched(saved.searched)
      setMode(saved.mode)
      setBoard(saved.board)
      setAnchorCells(new Set(saved.anchorCells))
      setBoardRoutes(saved.boardRoutes)
      setBoardMessage(saved.boardMessage)
      setObstacles(new Set(saved.obstacles))
      setAspectsOpen(saved.aspectsOpen)
      setPaletteQuery(saved.paletteQuery)
      setPendingAspect(saved.pendingAspect)
      setBoardSize(saved.boardSize)
    }
    setSessionReady(true)
  }, [sessionReady])

  useEffect(() => {
    if (!sessionReady || solvePhase !== 'idle') return
    const saved: ResearchSession = {
      enabled: [...enabled],
      activeAddons: [...activeAddons],
      from,
      to,
      minSpaces,
      result,
      searched,
      mode,
      board,
      anchorCells: [...anchorCells],
      boardRoutes,
      boardMessage,
      obstacles: [...obstacles],
      aspectsOpen,
      paletteQuery,
      pendingAspect,
      boardSize,
    }
    researchSessionCache = saved
    try {
      window.sessionStorage.setItem(researchSessionKey, JSON.stringify(saved))
    } catch {
      return
    }
  }, [
    sessionReady,
    solvePhase,
    enabled,
    activeAddons,
    from,
    to,
    minSpaces,
    result,
    searched,
    mode,
    board,
    anchorCells,
    boardRoutes,
    boardMessage,
    obstacles,
    aspectsOpen,
    paletteQuery,
    pendingAspect,
    boardSize,
  ])

  useEffect(
    () => () => {
      solveTokenRef.current += 1
      workerRef.current?.terminate()
      if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current)
    },
    [],
  )

  const toggleAddon = (id: string) => {
    if (solvePhase !== 'idle') cancelSolve()
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
    setResult(findAspectPath(from, to, minSpaces, catalog.combinations, enabled))
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

  const finishReveal = () => {
    const final = finalBoardRef.current
    if (!final) return
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current)
    revealFrameRef.current = null
    finalBoardRef.current = null
    previousViewRef.current = null
    setBoard(final.result.board)
    setBoardRoutes(final.result.routes)
    setSearchTrace(null)
    setRevealCell(null)
    setSolvePhase('idle')
    setBoardMessage(`${final.anchorCount} aspects connected.`)
  }

  const cancelSolve = () => {
    solveTokenRef.current += 1
    workerRef.current?.terminate()
    workerRef.current = null
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current)
    revealFrameRef.current = null
    finalBoardRef.current = null
    if (previousViewRef.current) {
      setBoard(previousViewRef.current.board)
      setBoardRoutes(previousViewRef.current.routes)
    }
    previousViewRef.current = null
    setSearchTrace(null)
    setRevealCell(null)
    setSolvePhase('idle')
    setBoardMessage('Search canceled.')
  }

  const startReveal = (solved: SolvedBoard, anchors: string[], token: number) => {
    const seen = new Set(anchors)
    const steps: string[] = []
    for (const route of solved.routes) {
      for (const id of route) {
        if (!seen.has(id)) {
          seen.add(id)
          steps.push(id)
        }
      }
    }
    finalBoardRef.current = { result: solved, anchorCount: anchors.length }
    setSearchTrace(null)

    if (steps.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishReveal()
      return
    }

    setSolvePhase('revealing')
    setBoardMessage('Filling map…')
    const stepDuration = Math.min(75, 900 / steps.length)
    const started = performance.now()
    let visibleCount = 0

    const reveal = (now: number) => {
      if (token !== solveTokenRef.current) return
      const nextCount = Math.min(steps.length, Math.floor((now - started) / stepDuration) + 1)
      if (nextCount > visibleCount) {
        visibleCount = nextCount
        const visible = new Set([...anchors, ...steps.slice(0, visibleCount)])
        setBoard(Object.fromEntries([...visible].map((id) => [id, solved.board[id]])))
        setBoardRoutes(
          solved.routes
            .map((route) => {
              const prefix: string[] = []
              for (const id of route) {
                if (!visible.has(id)) break
                prefix.push(id)
              }
              return prefix
            })
            .filter((route) => route.length > 1),
        )
        setRevealCell(steps[visibleCount - 1])
      }
      if (visibleCount === steps.length) finishReveal()
      else revealFrameRef.current = requestAnimationFrame(reveal)
    }

    revealFrameRef.current = requestAnimationFrame(reveal)
  }

  const solveEntireMap = () => {
    if (solvePhase !== 'idle') return
    const anchors = [...anchorCells].filter((id) => board[id] && !obstacles.has(id))
    if (anchors.length < 2) {
      setBoardMessage('Place two aspects first.')
      return
    }

    const token = ++solveTokenRef.current
    const initialBoard = Object.fromEntries(anchors.map((id) => [id, board[id]])) as Record<
      string,
      string
    >
    previousViewRef.current = { board, routes: boardRoutes }
    setBoard(initialBoard)
    setBoardRoutes([])
    setSearchTrace(null)
    setSolvePhase('searching')
    setBoardMessage('Searching paths…')

    let settled = false
    const receiveResult = (result: ReturnType<typeof solveAllAnchors>) => {
      if (token !== solveTokenRef.current || settled) return
      settled = true
      workerRef.current?.terminate()
      workerRef.current = null
      if ('board' in result) {
        startReveal(result, anchors, token)
      } else {
        if (previousViewRef.current) {
          setBoard(previousViewRef.current.board)
          setBoardRoutes(previousViewRef.current.routes)
        }
        previousViewRef.current = null
        setSearchTrace(null)
        setSolvePhase('idle')
        setBoardMessage(result.message)
      }
    }

    const fallback = () =>
      receiveResult(solveAllAnchors(board, anchorCells, obstacles, boardSize, catalog, enabled))

    try {
      const worker = new Worker(new URL('./boardSolver.worker.ts', import.meta.url))
      workerRef.current = worker
      worker.onmessage = (event: MessageEvent<SolveResponse>) => {
        if (token !== solveTokenRef.current || settled) return
        if (event.data.type === 'search') setSearchTrace(event.data.progress)
        else if (event.data.type === 'complete') receiveResult(event.data.result)
        else fallback()
      }
      worker.onerror = (event) => {
        event.preventDefault()
        if (token === solveTokenRef.current) fallback()
      }
      worker.postMessage({
        board,
        anchors,
        obstacles: [...obstacles],
        boardSize,
        catalog,
        enabled: [...enabled],
      } satisfies SolveRequest)
    } catch {
      fallback()
    }
  }

  const searchCells = new Set(searchTrace?.path ?? [])
  const used = result
    ? result.slice(1, -1).reduce<Record<string, number>>((total, aspect) => {
        total[aspect] = (total[aspect] ?? 0) + 1
        return total
      }, {})
    : {}
  const paletteAspects = catalog.aspects.filter(
    (aspect) =>
      enabled.has(aspect) &&
      `${label(aspect)} ${aspect}`.toLocaleLowerCase().includes(paletteQuery.toLocaleLowerCase()),
  )
  const boardRouteOrder = useMemo(() => {
    const order = new Map<string, number>()
    for (const route of boardRoutes) {
      for (const id of route) {
        if (!order.has(id)) order.set(id, order.size + 1)
      }
    }
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
    <>
      <div className="page-heading">
        <h1>{mode === 'quick' ? 'Quick Search' : 'Research Map'}</h1>
        <button
          className="secondary-link"
          type="button"
          onClick={() => {
            if (solvePhase !== 'idle') cancelSolve()
            setMode(mode === 'quick' ? 'board' : 'quick')
          }}
        >
          {mode === 'quick' ? (
            <>
              <span aria-hidden="true">←</span> Research Map
            </>
          ) : (
            <>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" />
              </svg>{' '}
              Quick Search
            </>
          )}
        </button>
      </div>

      {mode === 'quick' && (
        <section className="quick-layout" aria-label="Quick aspect search">
          <div className="panel quick-form">
            <div className="section-heading">
              <h2>Connection</h2>
            </div>
            <div className="aspect-selects">
              <AspectSelect
                caption="From"
                value={from}
                aspects={catalog.aspects}
                onChange={setFrom}
              />
              <button
                className="swap-aspects"
                type="button"
                onClick={() => {
                  setFrom(to)
                  setTo(from)
                }}
                aria-label="Swap aspects"
                title="Swap aspects"
              >
                ⇄
              </button>
              <AspectSelect caption="To" value={to} aspects={catalog.aspects} onChange={setTo} />
            </div>
            <label className="field-label">
              Empty spaces <strong>{minSpaces}</strong>
              <input
                type="range"
                min="1"
                max="10"
                value={minSpaces}
                onChange={(event) => setMinSpaces(Number(event.target.value))}
              />
            </label>
            <button className="primary-button" type="button" onClick={runSearch}>
              Find connection <span aria-hidden="true">→</span>
            </button>
          </div>
          <aside className="panel quick-result" aria-live="polite">
            <div className="section-heading">
              <h2>Chain</h2>
            </div>
            {result && (
              <>
                <ol className="path-list">
                  {result.map((aspect, index) => (
                    <li key={result.slice(0, index + 1).join('>')}>
                      <div className="path-aspect">
                        <AspectIcon aspect={aspect} />
                        <span>{label(aspect)}</span>
                        <small>{aspect}</small>
                      </div>
                      {index < result.length - 1 && <span className="path-arrow">↓</span>}
                    </li>
                  ))}
                </ol>
                <div className="used-aspects">
                  <span>
                    {result.length - 2} intermediate {result.length === 3 ? 'aspect' : 'aspects'}
                  </span>
                  <div>
                    {Object.entries(used).map(([aspect, count]) => (
                      <span className="used-icon" key={aspect} title={`${label(aspect)}: ${count}`}>
                        <AspectIcon aspect={aspect} />
                        <span className="used-count">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
            {!result && (
              <div className="empty-result">{searched ? 'No chain found.' : 'No chain yet.'}</div>
            )}
          </aside>
        </section>
      )}

      {mode === 'board' && (
        <section
          className={`panel research-board ${solvePhase !== 'idle' ? 'is-solving' : ''}`}
          aria-label="Research map"
        >
          <div className="board-toolbar">
            {/* biome-ignore lint/a11y/useSemanticElements: This compact stepper uses its own accessible group label. */}
            <div className="board-radius" role="group" aria-label="Map radius">
              <span>Rings</span>
              <div className="board-radius-stepper">
                <button
                  type="button"
                  aria-label="Decrease map radius"
                  disabled={boardSize <= minimumBoardSize || solvePhase !== 'idle'}
                  onClick={() => changeBoardSize(boardSize - 2)}
                >
                  −
                </button>
                <output aria-live="polite">{Math.floor(boardSize / 2)}</output>
                <button
                  type="button"
                  aria-label="Increase map radius"
                  disabled={boardSize >= maximumBoardSize || solvePhase !== 'idle'}
                  onClick={() => changeBoardSize(boardSize + 2)}
                >
                  +
                </button>
              </div>
            </div>
            <p className="board-status" role="status">
              {boardMessage}
            </p>
            <div className="board-action-buttons">
              {solvePhase !== 'idle' && (
                <button
                  className="quiet-button board-solve-control"
                  type="button"
                  onClick={solvePhase === 'searching' ? cancelSolve : finishReveal}
                >
                  {solvePhase === 'searching' ? 'Cancel' : 'Show result'}
                </button>
              )}
              <button
                className="primary-button board-auto-button"
                type="button"
                aria-label="Auto-connect all"
                disabled={solvePhase !== 'idle'}
                onClick={solveEntireMap}
              >
                <WandIcon />
                <span className="board-auto-label-full">Auto-connect all</span>
                <span className="board-auto-label-short">Connect all</span>
              </button>
              <button
                className="quiet-button board-clear-button"
                type="button"
                aria-label="Clear map"
                title="Clear map"
                disabled={solvePhase !== 'idle'}
                onClick={() => {
                  setBoard({})
                  setAnchorCells(new Set())
                  setObstacles(new Set())
                  setBoardRoutes([])
                  setBoardMessage('')
                }}
              >
                <BroomIcon />
              </button>
            </div>
          </div>
          <div
            className="board-layout"
            style={{ '--board-map-height': `${boardMapHeight}px` } as CSSProperties}
          >
            <aside className="board-palette">
              <div className="palette-heading">
                <strong>{pendingAspect ? `${label(pendingAspect)} selected` : 'Aspects'}</strong>
              </div>
              <input
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Search aspects…"
                aria-label="Search map aspects"
              />
              <div className="palette-list">
                {paletteAspects.map((aspect) => (
                  <button
                    type="button"
                    className={pendingAspect === aspect ? 'is-active' : ''}
                    aria-pressed={pendingAspect === aspect}
                    disabled={solvePhase !== 'idle'}
                    draggable={solvePhase === 'idle'}
                    onDragStart={(event) => {
                      dragRef.current = true
                      event.dataTransfer.setData('text/aspect', aspect)
                    }}
                    onDragEnd={() =>
                      window.setTimeout(() => {
                        dragRef.current = false
                      }, 0)
                    }
                    onClick={() => setPendingAspect(aspect)}
                    key={aspect}
                  >
                    <AspectIcon aspect={aspect} />
                    <span>{label(aspect)}</span>
                    <small>{aspect}</small>
                  </button>
                ))}
                {paletteAspects.length === 0 && <p className="palette-empty">No aspects found.</p>}
              </div>
            </aside>
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
                        <polyline
                          className="board-search-line"
                          points={routePoints(searchTrace.path)}
                        />
                      )}
                    </svg>
                  )}
                  {getBoardCells(boardSize).map(({ row, column }) => {
                    const id = cellId(row, column)
                    const aspect = board[id]
                    const routeNumber = boardRouteOrder.get(id)
                    const blocked = obstacles.has(id)
                    const activateCell = () => {
                      if (dragRef.current || solvePhase !== 'idle') return
                      if (pendingAspect && !blocked) {
                        placeAspect(id, pendingAspect)
                        setPendingAspect(null)
                      } else toggleObstacle(id)
                    }
                    return (
                      // biome-ignore lint/a11y: Hex cells need drag and drop and can contain a nested remove button.
                      <div
                        key={id}
                        role={aspect ? 'group' : 'button'}
                        tabIndex={solvePhase === 'idle' ? 0 : -1}
                        aria-disabled={solvePhase !== 'idle'}
                        aria-label={
                          aspect
                            ? `${label(aspect)} on cell ${id}`
                            : `Cell ${id}, ${blocked ? 'blocked' : 'open'}`
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
                          <span className="blocked-mark" aria-hidden="true">
                            ×
                          </span>
                        ) : (
                          aspect && (
                            <>
                              {routeNumber !== undefined && (
                                <span className="cell-order">{routeNumber}</span>
                              )}
                              <AspectIcon aspect={aspect} />
                              <b>{label(aspect)}</b>
                              <small>{aspect}</small>
                              <button
                                type="button"
                                className="remove-cell"
                                disabled={solvePhase !== 'idle'}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setBoard((previous) => {
                                    const next = { ...previous }
                                    delete next[id]
                                    return next
                                  })
                                  setAnchorCells((previous) => {
                                    const next = new Set(previous)
                                    next.delete(id)
                                    return next
                                  })
                                  setBoardRoutes([])
                                }}
                                aria-label={`Remove ${label(aspect)} from the map`}
                              >
                                ×
                              </button>
                            </>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="panel aspect-settings" inert={solvePhase !== 'idle'}>
        <button
          className="settings-toggle"
          type="button"
          aria-expanded={aspectsOpen}
          onClick={() => setAspectsOpen((current) => !current)}
        >
          <span>
            <span className="settings-icon" aria-hidden="true">
              ⚙
            </span>
            <strong>Available Aspects</strong>
            {unavailableCount > 0 && <small>{unavailableCount} excluded</small>}
          </span>
          <span aria-hidden="true">{aspectsOpen ? '−' : '+'}</span>
        </button>
        {aspectsOpen && (
          <div className="settings-content">
            <div className="inventory-header">
              <div className="inventory-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEnabled(new Set(catalog.aspects))
                    setActiveAddons(new Set(addonEntries.map(([id]) => id)))
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnabled(new Set())
                    setActiveAddons(new Set())
                  }}
                >
                  Deselect all
                </button>
              </div>
            </div>
            <div className="addons">
              {addonEntries.map(([id, addon]) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={activeAddons.has(id)}
                    onChange={() => toggleAddon(id)}
                  />{' '}
                  <span>{addon.name}</span>
                </label>
              ))}
            </div>
            <div className="aspect-grid">
              {catalog.aspects.map((aspect) => {
                const available = enabled.has(aspect)
                const parts = catalog.combinations[aspect]
                return (
                  <button
                    className={`aspect-card ${available ? '' : 'is-disabled'}`}
                    type="button"
                    aria-pressed={available}
                    key={aspect}
                    onClick={() =>
                      setEnabled((previous) => {
                        const next = new Set(previous)
                        if (available) next.delete(aspect)
                        else next.add(aspect)
                        return next
                      })
                    }
                    title={parts ? `${label(parts[0])} + ${label(parts[1])}` : 'Primal aspect'}
                  >
                    <AspectIcon aspect={aspect} muted={!available} />
                    <span>{label(aspect)}</span>
                    <small>{aspect}</small>
                    {parts && <em>{parts.map(label).join(' + ')}</em>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
