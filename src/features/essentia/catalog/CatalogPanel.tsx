'use client'

import { CatalogItem } from '@/features/essentia/catalog/CatalogItem'
import { SavedSources } from '@/features/essentia/catalog/SavedSources'
import { key as itemKey } from '@/features/essentia/model/planner'
import type { CatalogSort } from '@/features/essentia/model/types'
import { displayItemName } from '@/features/essentia/shared/format'
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
  } = controller
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
      <div className="ess-catalog-list">
        {matchesShown.map((item) => (
          <CatalogItem key={itemKey(item)} item={item} controller={controller} />
        ))}
        {catalog && catalogSearching && filteredItems.length === 0 && (
          <p className="ess-no-results">Searching items…</p>
        )}
        {catalog &&
          !catalogSearching &&
          filteredItems.length === 0 &&
          unprofiledMatches.length === 0 && (
            <p className="ess-no-results">
              Nothing found. Try another name or the Entire catalog filter.
            </p>
          )}
      </div>
      {visibleCount < filteredItems.length && (
        <button
          className="ess-show-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + 30)}
        >
          Show 30 more <span>↓</span>
        </button>
      )}
      {!catalogSearching && unprofiledMatches.length > 0 && (
        <details className="ess-unprofiled" open={filteredItems.length === 0}>
          <summary>
            {unprofiledMatches.length.toLocaleString('en-US')} items found in GTNH 2.9 without
            aspect profiles
          </summary>
          <p>
            These items exist in the pack, but the current export does not include their furnace
            aspects. They are excluded from calculations.
          </p>
          <div>
            {unprofiledMatches.slice(0, 24).map((item) => (
              <div className="ess-unprofiled-row" key={item.registryId}>
                <strong>{displayItemName(item.name)}</strong>
                <small>{item.registryId}</small>
              </div>
            ))}
          </div>
          {unprofiledMatches.length > 24 && (
            <small>Showing the first 24 matches. Refine your search for more.</small>
          )}
        </details>
      )}
      <details className="ess-data-note">
        <summary>About data and icons</summary>
        <p>
          The catalog contains {catalog?.aspectSource?.count.toLocaleString('en-US') ?? '—'}{' '}
          profiles from GTNH {catalog?.aspectSource?.version ?? ''} and{' '}
          {(catalog?.aspectSource?.fallbackCounts?.['2.8.0'] ?? 0).toLocaleString('en-US')}{' '}
          additional profiles from GTNH 2.8.0. Matches were checked by ID, mod, and name; GTNH 2.9
          data takes priority. Earlier profiles are labeled and can be used in calculations, but
          their 2.9 furnace behavior is unverified. Items without profiles appear only in search.
          Effort is estimated from{' '}
          {catalog?.acquisitionSource?.recipeCount.toLocaleString('en-US') ?? '—'} GTNH 2.9 machine
          and farm recipes; crafting table recipes are absent from this export. Icons come from{' '}
          <a href="https://github.com/ShadowTheAge/gtnh-2.7.4" target="_blank" rel="noreferrer">
            the GTNH atlas
          </a>{' '}
          and{' '}
          <a
            href="https://github.com/Samiracle64/gtnh-factory-flow"
            target="_blank"
            rel="noreferrer"
          >
            the GTNH 2.9 resource index
          </a>
          .
        </p>
      </details>
    </section>
  )
}
