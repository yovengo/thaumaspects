'use client'

import { useEffect, useRef, useState } from 'react'
import { useAspectAvailability } from '@/features/research-map/availability/useAspectAvailability'
import { useResearchBoard } from '@/features/research-map/board/useResearchBoard'
import { getCatalog } from '@/features/research-map/model/catalog'
import { useQuickSearch } from '@/features/research-map/quick-search/useQuickSearch'
import {
  getCachedResearchSession,
  type ResearchMode,
  type ResearchSession,
  readResearchSession,
  saveResearchSession,
} from '@/features/research-map/state/researchSession'

const catalog = getCatalog()

export function useResearchMap() {
  const initialSession = useRef(typeof window !== 'undefined' ? getCachedResearchSession() : null)
  const [sessionReady, setSessionReady] = useState(Boolean(initialSession.current))
  const [mode, setMode] = useState<ResearchMode>(initialSession.current?.mode ?? 'board')
  const availability = useAspectAvailability(initialSession.current, catalog)
  const quickSearch = useQuickSearch(initialSession.current, catalog, availability.enabled)
  const researchBoard = useResearchBoard(initialSession.current, catalog, availability.enabled)

  const { enabled, activeAddons, aspectsOpen, restoreAvailability } = availability
  const { from, to, minSpaces, result, searched, restoreQuickSearch } = quickSearch
  const {
    board,
    anchorCells,
    boardRoutes,
    boardMessage,
    obstacles,
    paletteQuery,
    pendingAspect,
    boardSize,
    solvePhase,
    restoreResearchBoard,
  } = researchBoard

  useEffect(() => {
    if (sessionReady) return
    const saved = readResearchSession()
    if (saved) {
      restoreAvailability(saved)
      restoreQuickSearch(saved)
      restoreResearchBoard(saved)
      setMode(saved.mode)
    }
    setSessionReady(true)
  }, [sessionReady, restoreAvailability, restoreQuickSearch, restoreResearchBoard])

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
    saveResearchSession(saved)
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

  const toggleAddon = (id: string) => {
    if (solvePhase !== 'idle') researchBoard.cancelSolve()
    availability.toggleAddon(id)
  }

  const switchMode = () => {
    if (solvePhase !== 'idle') researchBoard.cancelSolve()
    setMode(mode === 'quick' ? 'board' : 'quick')
  }

  return {
    catalog,
    mode,
    switchMode,
    quickSearch,
    researchBoard,
    availability: { ...availability, toggleAddon },
  }
}
