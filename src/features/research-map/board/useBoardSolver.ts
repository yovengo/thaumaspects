'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  type BoardSearchProgress,
  type SolvedBoard,
  solveAllAnchors,
} from '@/features/research-map/board/boardSolver'
import type { SolveRequest, SolveResponse } from '@/features/research-map/board/boardSolver.worker'
import type { Catalog } from '@/features/research-map/model/types'

type BoardSolverInput = {
  board: Record<string, string>
  setBoard: Dispatch<SetStateAction<Record<string, string>>>
  anchorCells: Set<string>
  boardRoutes: string[][]
  setBoardRoutes: Dispatch<SetStateAction<string[][]>>
  obstacles: Set<string>
  boardSize: number
  catalog: Catalog
  enabled: Set<string>
}

export function useBoardSolver({
  board,
  setBoard,
  anchorCells,
  boardRoutes,
  setBoardRoutes,
  obstacles,
  boardSize,
  catalog,
  enabled,
}: BoardSolverInput) {
  const [solvePhase, setSolvePhase] = useState<'idle' | 'searching' | 'revealing'>('idle')
  const [searchTrace, setSearchTrace] = useState<BoardSearchProgress | null>(null)
  const [revealCell, setRevealCell] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const revealFrameRef = useRef<number | null>(null)
  const solveTokenRef = useRef(0)
  const previousViewRef = useRef<{ board: Record<string, string>; routes: string[][] } | null>(null)
  const finalBoardRef = useRef<SolvedBoard | null>(null)

  useEffect(
    () => () => {
      solveTokenRef.current += 1
      workerRef.current?.terminate()
      if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current)
    },
    [],
  )

  const finishReveal = () => {
    const final = finalBoardRef.current
    if (!final) return
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current)
    revealFrameRef.current = null
    finalBoardRef.current = null
    previousViewRef.current = null
    setBoard(final.board)
    setBoardRoutes(final.routes)
    setSearchTrace(null)
    setRevealCell(null)
    setSolvePhase('idle')
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
    finalBoardRef.current = solved
    setSearchTrace(null)

    if (steps.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishReveal()
      return
    }

    setSolvePhase('revealing')
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
    if (anchors.length < 2) return

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

  return { solvePhase, searchTrace, revealCell, finishReveal, cancelSolve, solveEntireMap }
}
