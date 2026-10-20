'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  defaultBoardSize,
  hexHeight,
  hexRowStep,
} from '@/features/research-map/board/boardGeometry'
import { useBoardSolver } from '@/features/research-map/board/useBoardSolver'
import { aspectLabel as label } from '@/features/research-map/model/catalog'
import type { Catalog } from '@/features/research-map/model/types'
import type { ResearchSession } from '@/features/research-map/state/researchSession'

export function useResearchBoard(
  initial: ResearchSession | null,
  catalog: Catalog,
  enabled: Set<string>,
) {
  const [board, setBoard] = useState<Record<string, string>>(initial?.board ?? {})
  const [anchorCells, setAnchorCells] = useState<Set<string>>(
    () => new Set(initial?.anchorCells ?? []),
  )
  const [boardRoutes, setBoardRoutes] = useState<string[][]>(initial?.boardRoutes ?? [])
  const [obstacles, setObstacles] = useState<Set<string>>(() => new Set(initial?.obstacles ?? []))
  const dragRef = useRef(false)
  const [paletteQuery, setPaletteQuery] = useState(initial?.paletteQuery ?? '')
  const [pendingAspect, setPendingAspect] = useState<string | null>(initial?.pendingAspect ?? null)
  const [boardSize, setBoardSize] = useState(initial?.boardSize ?? defaultBoardSize)
  const { solvePhase, searchTrace, revealCell, finishReveal, cancelSolve, solveEntireMap } =
    useBoardSolver({
      board,
      setBoard,
      anchorCells,
      boardRoutes,
      setBoardRoutes,
      obstacles,
      boardSize,
      catalog,
      enabled,
    })

  const restoreResearchBoard = useCallback((saved: ResearchSession) => {
    setBoard(saved.board)
    setAnchorCells(new Set(saved.anchorCells))
    setBoardRoutes(saved.boardRoutes)
    setObstacles(new Set(saved.obstacles))
    setPaletteQuery(saved.paletteQuery)
    setPendingAspect(saved.pendingAspect)
    setBoardSize(saved.boardSize)
  }, [])

  const placeAspect = (target: string, aspect: string) => {
    setBoard((previous) => ({ ...previous, [target]: aspect }))
    setPendingAspect(null)
    setAnchorCells((previous) => new Set(previous).add(target))
    setBoardRoutes([])
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
  }

  const searchCells = new Set(searchTrace?.path ?? [])
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
  }

  const toggleObstacle = (id: string) => {
    setObstacles((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setBoardRoutes([])
  }

  const clearMap = () => {
    setBoard({})
    setAnchorCells(new Set())
    setObstacles(new Set())
    setBoardRoutes([])
  }

  const removeAspect = (id: string) => {
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
  }

  const boardCanvasHeight = (boardSize - 1) * hexRowStep + hexHeight + hexRowStep / 2

  return {
    board,
    anchorCells,
    boardRoutes,
    obstacles,
    dragRef,
    paletteQuery,
    setPaletteQuery,
    pendingAspect,
    setPendingAspect,
    boardSize,
    solvePhase,
    searchTrace,
    searchCells,
    revealCell,
    paletteAspects,
    boardRouteOrder,
    boardCanvasHeight,
    boardMapHeight: Math.max(420, Math.ceil(boardCanvasHeight + 38)),
    restoreResearchBoard,
    placeAspect,
    moveAspect,
    finishReveal,
    cancelSolve,
    solveEntireMap,
    changeBoardSize,
    toggleObstacle,
    clearMap,
    removeAspect,
  }
}

export type ResearchBoardController = ReturnType<typeof useResearchBoard>
