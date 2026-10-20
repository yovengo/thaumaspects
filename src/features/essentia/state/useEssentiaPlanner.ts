'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'
import { useItemAvailability } from '@/features/essentia/availability/useItemAvailability'
import { useCatalogView } from '@/features/essentia/catalog/useCatalogView'
import { countForItem } from '@/features/essentia/model/itemQuantity'
import type { ItemAspect, Requirement } from '@/features/essentia/model/planner'
import { key as itemKey, planFromLines, prepareItems } from '@/features/essentia/model/planner'
import type { Catalog } from '@/features/essentia/model/types'
import { scrollBehavior } from '@/features/essentia/shared/format'
import { usePlannerSession } from '@/features/essentia/state/usePlannerSession'
import { useTargetRows } from '@/features/essentia/target/useTargetRows'
import { usePlannerResults } from '@/features/essentia/worker/usePlannerResults'

export function useEssentiaPlanner() {
  const session = usePlannerSession()
  const {
    rows,
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
  } = session
  const catalogQuery = useQuery({
    queryKey: ['catalog', 'gtnh-2.9.0-beta-2'],
    queryFn: async ({ signal }): Promise<Catalog> => {
      const response = await fetch('/item-aspects-gtnh.json', { signal })
      if (!response.ok) throw new Error('Catalog unavailable')
      const data = (await response.json()) as Catalog
      return { ...data, items: prepareItems(data.items) }
    },
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnReconnect: false,
  })
  const catalog = catalogQuery.data ?? null
  const loadError = catalogQuery.isError
  const {
    availability,
    setAvailability,
    preferItem,
    excludeItem,
    restoreItem,
    removeManagedSource,
  } = useItemAvailability()
  const resultRef = useRef<HTMLDivElement>(null)
  const sourceSearchRef = useRef<HTMLInputElement>(null)
  const catalogSearchRef = useRef<HTMLInputElement>(null)
  const catalogRef = useRef<HTMLElement>(null)

  const {
    required,
    requestedAspects,
    requestedTotal,
    availableAspects,
    usedAspects,
    updateRow,
    changeAmount,
    stepAmount,
    addRow,
    removeRow,
  } = useTargetRows(session, catalog)
  const activeCatalogFilter = requestedAspects.length === 0 ? 'allItems' : catalogFilter
  const preferences = useMemo(
    () => ({
      preferred: new Set(availability.preferred),
      excluded: new Set(availability.excluded),
      stage: availability.stage,
    }),
    [availability],
  )
  const {
    workerFailed,
    planRequest,
    planResult,
    calculating,
    refining,
    plans,
    catalogRequest,
    sourceRequest,
    catalogResult,
    sourceResult,
  } = usePlannerResults({
    catalog,
    required,
    requestedAspects,
    requestedTotal,
    availability,
    query,
    activeCatalogFilter,
    catalogSort,
    catalogOpen,
    sourceQuery,
    sourcePickerOpen,
  })
  const {
    managedSources,
    variantLabels,
    catalogSearching,
    sourceSearching,
    filteredItems,
    sourceMatches,
    unprofiledMatches,
    matchesShown,
  } = useCatalogView({
    catalog,
    availability,
    sourcesOpen,
    sourcesFilter,
    sourcesQuery,
    query,
    catalogOpen,
    sourcePickerOpen,
    workerFailed,
    catalogResult,
    sourceResult,
    catalogRequest,
    sourceRequest,
    visibleCount,
  })
  const customPlan = useMemo(() => planFromLines(customLines, required), [customLines, required])
  const selected =
    requestedTotal <= 0
      ? undefined
      : selectedId === 'custom' && customLines.length
        ? customPlan
        : (plans.find((plan) => plan.id === selectedId) ?? plans[0])
  const resultRequired: Requirement =
    calculating && selectedId !== 'custom' && planResult?.plans.length
      ? JSON.parse(planResult.request)[0]
      : required
  const resultAspects = Object.keys(resultRequired)
  const shortage = selected
    ? Object.entries(selected.remaining).filter(([, amount]) => amount > 0)
    : []
  const chooseItem = (item: ItemAspect) => {
    const coversAll = requestedAspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)
    const current = selectedId === 'custom' ? customLines : []
    const needed = coversAll ? required : planFromLines(current, required).remaining
    const count = countForItem(item, needed)
    if (count === null) return
    const found = current.find((line) => itemKey(line.item) === itemKey(item))
    const next = coversAll
      ? [{ item, count }]
      : found
        ? current.map((line) => (line === found ? { ...line, count: line.count + count } : line))
        : [...current, { item, count }]
    setCustomLines(next)
    setSelectedId('custom')
    if (Object.values(planFromLines(next, required).remaining).every((amount) => amount === 0)) {
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }),
      )
    }
  }
  const updateCustomCount = (item: ItemAspect, count: number) => {
    if (count <= 0 && customLines.length === 1) setSelectedId(null)
    setCustomLines((previous) =>
      previous
        .map((line) => (itemKey(line.item) === itemKey(item) ? { ...line, count } : line))
        .filter((line) => line.count > 0),
    )
  }
  const selectPlan = (id: string) => {
    setSelectedId(id)
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }),
    )
  }
  const openSourcePicker = () => {
    setSourcePickerOpen(true)
    requestAnimationFrame(() => sourceSearchRef.current?.focus())
  }
  const openCatalogSearch = () => {
    setCatalogOpen(true)
    setQuery(sourceQuery)
    setCatalogFilter('anySelected')
    setVisibleCount(30)
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
      catalogSearchRef.current?.focus({ preventScroll: true })
    })
  }
  const toggleExpanded = (key: string) =>
    setExpandedItems((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const catalogNeeded =
    selectedId === 'custom' && customLines.length > 0 ? customPlan.remaining : required
  const visiblePlans = alternativesOpen
    ? plans
    : [...plans.slice(0, 3), ...plans.slice(3).filter((plan) => plan.id === selectedId)]

  return {
    target: {
      rows,
      availableAspects,
      usedAspects,
      updateRow,
      stepAmount,
      changeAmount,
      removeRow,
      addRow,
      availability,
      setAvailability,
    },
    furnace: {
      calculating,
      selectedId,
      setSelectedId,
      selected,
      refining,
      catalog,
      loadError,
      requestedAspects,
      workerFailed,
      planResult,
      planRequest,
      resultRef,
      resultRequired,
      expandedItems,
      toggleExpanded,
      updateCustomCount,
      excludeItem,
      resultAspects,
      shortage,
      sourcePickerOpen,
      setSourcePickerOpen,
      openSourcePicker,
      sourceSearchRef,
      sourceQuery,
      setSourceQuery,
      sourceVisibleCount,
      setSourceVisibleCount,
      sourceSearching,
      sourceMatches,
      preferences,
      required,
      chooseItem,
      openCatalogSearch,
    },
    alternatives: {
      plans,
      calculating,
      selected,
      visiblePlans,
      selectPlan,
      alternativesOpen,
      setAlternativesOpen,
    },
    catalog: {
      catalogOpen,
      setCatalogOpen,
      catalog,
      loadError,
      catalogSearchRef,
      query,
      setQuery,
      setVisibleCount,
      catalogSort,
      setCatalogSort,
      activeCatalogFilter,
      setCatalogFilter,
      catalogSearching,
      filteredItems,
      matchesShown,
      requestedAspects,
      visibleCount,
      unprofiledMatches,
      catalogRef,
      required,
      catalogNeeded,
      expandedItems,
      preferences,
      variantLabels,
      toggleExpanded,
      chooseItem,
      restoreItem,
      preferItem,
      availability,
      sourcesOpen,
      sourcesFilter,
      setSourcesOpen,
      setSourcesFilter,
      setSourcesQuery,
      setSourcesVisibleCount,
      sourcesQuery,
      managedSources,
      removeManagedSource,
      sourcesVisibleCount,
    },
  }
}
