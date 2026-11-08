'use client'

import { useLayoutEffect, useRef } from 'react'
import { CatalogItem } from '@/features/essentia/catalog/CatalogItem'
import { SavedSources } from '@/features/essentia/catalog/SavedSources'
import { useFavoriteFlight } from '@/features/essentia/catalog/useFavoriteFlight'
import { key as itemKey } from '@/features/essentia/model/planner'
import type { CatalogSort } from '@/features/essentia/model/types'
import { CatalogIcon, Chevron } from '@/features/essentia/shared/icons'
import { SelectField } from '@/features/essentia/shared/SelectField'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'

export function CatalogPanel({
  controller,
}: {
  controller: ReturnType<typeof useEssentiaPlanner>['catalog']
}) {
  const {
    catalogOpen,
    setCatalogOpen,
    catalogRequest,
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
    catalogRef,
  } = controller
  const startFavoriteFlight = useFavoriteFlight(catalogSearching, catalogRequest)
  const listRef = useRef<HTMLDivElement>(null)
  const moreAnchor = useRef<{
    row: HTMLElement | null
    top: number
    previousCount: number
    keyboard: boolean
  } | null>(null)

  useLayoutEffect(() => {
    const anchor = moreAnchor.current
    if (!anchor || visibleCount <= anchor.previousCount) return
    moreAnchor.current = null
    if (anchor.row?.isConnected) {
      const shift = anchor.row.getBoundingClientRect().top - anchor.top
      if (Math.abs(shift) > 0.5) window.scrollBy({ top: shift, behavior: 'instant' })
    }
    if (anchor.keyboard) {
      const nextRow = listRef.current?.children[anchor.previousCount] as HTMLElement | undefined
      nextRow
        ?.querySelector<HTMLElement>('.ess-catalog-action button, .ess-availability-button')
        ?.focus({ preventScroll: true })
    }
  }, [visibleCount])

  const showMore = (button: HTMLButtonElement, keyboard: boolean) => {
    const row = listRef.current?.lastElementChild as HTMLElement | null
    moreAnchor.current = {
      row,
      top: row?.getBoundingClientRect().top ?? 0,
      previousCount: visibleCount,
      keyboard,
    }
    if (!keyboard) button.blur()
    setVisibleCount((count) => count + 30)
  }

  return (
    <section
      className={`panel ess-catalog ${catalogOpen ? 'is-open' : ''}`}
      aria-label="Full item catalog"
      ref={catalogRef}
    >
      <div className="ess-catalog-header">
        <button
          className="ess-catalog-entry"
          type="button"
          aria-expanded={catalogOpen}
          onClick={() => setCatalogOpen((current) => !current)}
        >
          <span className="ess-catalog-entry-icon">
            <CatalogIcon />
          </span>
          <span className="ess-catalog-entry-copy">
            <strong>Catalog</strong>
            <small>
              {catalog
                ? `${catalog.items.length.toLocaleString('en-US')} items`
                : loadError
                  ? 'Unavailable'
                  : 'Loading…'}
            </small>
          </span>
          <span className="ess-catalog-entry-action">
            {catalogOpen ? 'Close' : 'Browse items'}
            <Chevron />
          </span>
        </button>
      </div>
      <div>
        <SavedSources controller={controller} />
        <div className="ess-catalog-toolbar">
          <div className="ess-catalog-search-field">
            <label className="ess-catalog-search">
              <span aria-hidden="true">⌕</span>
              <input
                ref={catalogSearchRef}
                type="search"
                placeholder="Item name or ID"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setVisibleCount(30)
                }}
                aria-label="Search items"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('')
                    setVisibleCount(30)
                  }}
                >
                  ×
                </button>
              )}
            </label>
          </div>
          <div className="ess-sort">
            <SelectField
              label="Sort by"
              value={catalogSort}
              options={[
                ['practical', 'Easiest to get'],
                ['quantity', 'Fewest items'],
                ['name', 'Name'],
              ]}
              onChange={(sort) => {
                setCatalogSort(sort as CatalogSort)
                setVisibleCount(30)
              }}
            />
          </div>
        </div>
        <fieldset className="ess-filter-tabs" aria-label="Item filter">
          <button
            type="button"
            className={activeCatalogFilter === 'allSelected' ? 'is-active' : ''}
            disabled={requestedAspects.length === 0}
            onClick={() => {
              setCatalogFilter('allSelected')
              setVisibleCount(30)
            }}
          >
            All aspects
          </button>
          <button
            type="button"
            className={activeCatalogFilter === 'anySelected' ? 'is-active' : ''}
            disabled={requestedAspects.length === 0}
            onClick={() => {
              setCatalogFilter('anySelected')
              setVisibleCount(30)
            }}
          >
            Any aspect
          </button>
          <button
            type="button"
            className={activeCatalogFilter === 'allItems' ? 'is-active' : ''}
            onClick={() => {
              setCatalogFilter('allItems')
              setVisibleCount(30)
            }}
          >
            All items
          </button>
        </fieldset>
        <div className="ess-catalog-summary" aria-busy={catalogSearching}>
          <strong>{filteredItems.length.toLocaleString('en-US')}</strong>
          <span>items</span>
          {catalogSearching && (
            <span className="ess-catalog-updating" role="status">
              Updating…
            </span>
          )}
        </div>
        <div className="ess-catalog-list" ref={listRef}>
          {matchesShown.map((item) => (
            <CatalogItem
              key={itemKey(item)}
              item={item}
              controller={controller}
              onFavoriteAdd={startFavoriteFlight}
            />
          ))}
          {catalog && catalogSearching && filteredItems.length === 0 && (
            <p className="ess-no-results">Searching items…</p>
          )}
          {catalog && !catalogSearching && filteredItems.length === 0 && (
            <p className="ess-no-results">
              Nothing found. Try another name or the All items filter.
            </p>
          )}
        </div>
        {visibleCount < filteredItems.length && (
          <button
            className="ess-show-more"
            type="button"
            onClick={(event) => showMore(event.currentTarget, event.detail === 0)}
          >
            Show 30 more <span>↓</span>
          </button>
        )}
        {catalog && (
          <details className="ess-data-note">
            <summary>Data source</summary>
            <p>
              {catalog.aspectSource.count.toLocaleString('en-US')} aspect profiles from GTNH{' '}
              {catalog.aspectSource.version}. Item difficulty is estimated from item type and aspect
              concentration. The export does not verify individual Alchemical Furnace acceptance.
            </p>
          </details>
        )}
      </div>
    </section>
  )
}
