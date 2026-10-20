'use client'

import { useMemo } from 'react'
import { key as itemKey } from '@/features/essentia/model/planner'
import type { Availability, Catalog, IndexResult } from '@/features/essentia/model/types'
import { displayItemName } from '@/features/essentia/shared/format'

type CatalogViewInput = {
  catalog: Catalog | null
  availability: Availability
  sourcesOpen: boolean
  sourcesFilter: 'favorite' | 'excluded'
  sourcesQuery: string
  query: string
  catalogOpen: boolean
  sourcePickerOpen: boolean
  workerFailed: boolean
  catalogResult: IndexResult | null | undefined
  sourceResult: IndexResult | null | undefined
  catalogRequest: string
  sourceRequest: string
  visibleCount: number
}

export function useCatalogView({
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
}: CatalogViewInput) {
  const availabilityItems = useMemo(
    () => new Map(catalog?.items.map((item) => [itemKey(item), item]) ?? []),
    [catalog],
  )
  const managedSources = useMemo(() => {
    if (!sourcesOpen) return []
    const normalized = sourcesQuery.trim().toLocaleLowerCase()
    return (sourcesFilter === 'favorite' ? availability.preferred : availability.excluded)
      .map((id) => ({ id, kind: sourcesFilter }))
      .map((source) => {
        const item = availabilityItems.get(source.id)
        return {
          ...source,
          item,
          name: item ? displayItemName(item.name) : source.id.split('|')[0],
        }
      })
      .filter(
        (source) =>
          !normalized ||
          `${source.name} ${source.item?.registryId ?? ''}`
            .toLocaleLowerCase()
            .includes(normalized),
      )
  }, [sourcesOpen, sourcesFilter, sourcesQuery, availability, availabilityItems])
  const variantLabels = useMemo(() => {
    const counts = new Map<string, number>()
    const positions = new Map<string, number>()
    const labels = new Map<string, string>()
    catalog?.items.forEach((item) => {
      const name = displayItemName(item.name)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    })
    catalog?.items.forEach((item) => {
      const name = displayItemName(item.name)
      const count = counts.get(name) ?? 0
      if (count < 2) return
      const position = (positions.get(name) ?? 0) + 1
      positions.set(name, position)
      labels.set(itemKey(item), `Variant ${position} of ${count}`)
    })
    return labels
  }, [catalog])

  const catalogSearching = catalogOpen && !workerFailed && catalogResult?.request !== catalogRequest
  const sourceSearching =
    sourcePickerOpen && !workerFailed && sourceResult?.request !== sourceRequest
  const filteredItems = useMemo(
    () => (catalog ? (catalogResult?.indices.map((index) => catalog.items[index]) ?? []) : []),
    [catalog, catalogResult],
  )
  const sourceMatches = useMemo(
    () => (catalog ? (sourceResult?.indices.map((index) => catalog.items[index]) ?? []) : []),
    [catalog, sourceResult],
  )
  const unprofiledMatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!catalog?.unprofiledItems || normalized.length < 2) return []
    return catalog.unprofiledItems
      .filter((item) =>
        `${displayItemName(item.name)} ${item.registryId}`.toLocaleLowerCase().includes(normalized),
      )
      .sort(
        (a, b) =>
          Number(displayItemName(b.name).toLocaleLowerCase() === normalized) -
            Number(displayItemName(a.name).toLocaleLowerCase() === normalized) ||
          a.name.localeCompare(b.name),
      )
  }, [catalog, query])

  const matchesShown = filteredItems.slice(0, visibleCount)
  return {
    managedSources,
    variantLabels,
    catalogSearching,
    sourceSearching,
    filteredItems,
    sourceMatches,
    unprofiledMatches,
    matchesShown,
  }
}
