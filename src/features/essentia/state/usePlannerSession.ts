'use client'

import { useEffect, useRef, useState } from 'react'
import type { PlanLine } from '@/features/essentia/model/planner'
import type {
  CatalogFilter,
  CatalogSort,
  PlannerSession,
  Row,
} from '@/features/essentia/model/types'
import {
  getCachedPlannerSession,
  readPlannerSession,
  savePlannerSession,
} from '@/features/essentia/state/plannerSession'

export function usePlannerSession() {
  const initialSession = useRef(typeof window !== 'undefined' ? getCachedPlannerSession() : null)
  const [sessionReady, setSessionReady] = useState(Boolean(initialSession.current))
  const [rows, setRows] = useState<Row[]>(initialSession.current?.rows ?? [])
  const [nextId, setNextId] = useState(initialSession.current?.nextId ?? 1)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSession.current?.selectedId ?? null,
  )
  const [customLines, setCustomLines] = useState<PlanLine[]>(
    initialSession.current?.customLines ?? [],
  )
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>(
    initialSession.current?.catalogFilter ?? 'anySelected',
  )
  const [catalogSort, setCatalogSort] = useState<CatalogSort>(
    initialSession.current?.catalogSort ?? 'practical',
  )
  const [query, setQuery] = useState(initialSession.current?.query ?? '')
  const [sourceQuery, setSourceQuery] = useState(initialSession.current?.sourceQuery ?? '')
  const [sourcePickerOpen, setSourcePickerOpen] = useState(
    initialSession.current?.sourcePickerOpen ?? false,
  )
  const [sourceVisibleCount, setSourceVisibleCount] = useState(
    initialSession.current?.sourceVisibleCount ?? 12,
  )
  const [visibleCount, setVisibleCount] = useState(initialSession.current?.visibleCount ?? 30)
  const [catalogOpen, setCatalogOpen] = useState(initialSession.current?.catalogOpen ?? false)
  const [sourcesOpen, setSourcesOpen] = useState(initialSession.current?.sourcesOpen ?? false)
  const [sourcesFilter, setSourcesFilter] = useState<'favorite' | 'excluded'>(
    initialSession.current?.sourcesFilter ?? 'favorite',
  )
  const [sourcesQuery, setSourcesQuery] = useState(initialSession.current?.sourcesQuery ?? '')
  const [sourcesVisibleCount, setSourcesVisibleCount] = useState(
    initialSession.current?.sourcesVisibleCount ?? 30,
  )
  const [alternativesOpen, setAlternativesOpen] = useState(
    initialSession.current?.alternativesOpen ?? false,
  )
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    () => new Set(initialSession.current?.expandedItems ?? []),
  )
  useEffect(() => {
    if (sessionReady) return
    const saved = readPlannerSession()
    if (saved) {
      setRows(saved.rows)
      setNextId(saved.nextId)
      setSelectedId(saved.selectedId)
      setCustomLines(saved.customLines)
      setCatalogFilter(saved.catalogFilter)
      setCatalogSort(saved.catalogSort)
      setQuery(saved.query)
      setSourceQuery(saved.sourceQuery)
      setSourcePickerOpen(saved.sourcePickerOpen)
      setSourceVisibleCount(saved.sourceVisibleCount)
      setVisibleCount(saved.visibleCount)
      setCatalogOpen(saved.catalogOpen)
      setSourcesOpen(saved.sourcesOpen)
      setSourcesFilter(saved.sourcesFilter)
      setSourcesQuery(saved.sourcesQuery)
      setSourcesVisibleCount(saved.sourcesVisibleCount)
      setAlternativesOpen(saved.alternativesOpen)
      setExpandedItems(new Set(saved.expandedItems))
    }
    setSessionReady(true)
  }, [sessionReady])

  useEffect(() => {
    if (!sessionReady) return
    const saved: PlannerSession = {
      rows,
      nextId,
      selectedId,
      customLines,
      catalogFilter,
      catalogSort,
      query,
      sourceQuery,
      sourcePickerOpen,
      sourceVisibleCount,
      visibleCount,
      catalogOpen,
      sourcesOpen,
      sourcesFilter,
      sourcesQuery,
      sourcesVisibleCount,
      alternativesOpen,
      expandedItems: [...expandedItems],
    }
    savePlannerSession(saved)
  }, [
    sessionReady,
    rows,
    nextId,
    selectedId,
    customLines,
    catalogFilter,
    catalogSort,
    query,
    sourceQuery,
    sourcePickerOpen,
    sourceVisibleCount,
    visibleCount,
    catalogOpen,
    sourcesOpen,
    sourcesFilter,
    sourcesQuery,
    sourcesVisibleCount,
    alternativesOpen,
    expandedItems,
  ])

  return {
    rows,
    setRows,
    nextId,
    setNextId,
    selectedId,
    setSelectedId,
    customLines,
    setCustomLines,
    catalogFilter,
    setCatalogFilter,
    catalogSort,
    setCatalogSort,
    query,
    setQuery,
    sourceQuery,
    setSourceQuery,
    sourcePickerOpen,
    setSourcePickerOpen,
    sourceVisibleCount,
    setSourceVisibleCount,
    visibleCount,
    setVisibleCount,
    catalogOpen,
    setCatalogOpen,
    sourcesOpen,
    setSourcesOpen,
    sourcesFilter,
    setSourcesFilter,
    sourcesQuery,
    setSourcesQuery,
    sourcesVisibleCount,
    setSourcesVisibleCount,
    alternativesOpen,
    setAlternativesOpen,
    expandedItems,
    setExpandedItems,
  }
}
