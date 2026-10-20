'use client'

import { countForItem } from '@/features/essentia/model/itemQuantity'
import { key as itemKey } from '@/features/essentia/model/planner'
import { aspectLabel, displayItemName, itemWord } from '@/features/essentia/shared/format'
import { ItemIcon } from '@/features/essentia/shared/ItemIcon'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'

export function SourceBrowser({
  controller,
}: {
  controller: ReturnType<typeof useEssentiaPlanner>['furnace']
}) {
  const {
    catalog,
    requestedAspects,
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
  } = controller
  return (
    <>
      {catalog && requestedAspects.length > 0 && (
        <div className="ess-source-browser">
          <button
            className="ess-source-toggle"
            type="button"
            aria-expanded={sourcePickerOpen}
            onClick={() => (sourcePickerOpen ? setSourcePickerOpen(false) : openSourcePicker())}
          >
            <span>Build your own mix</span>
            <span aria-hidden="true">{sourcePickerOpen ? '−' : '+'}</span>
          </button>
          {sourcePickerOpen && (
            <div className="ess-source-content">
              <label className="ess-catalog-search">
                <span aria-hidden="true">⌕</span>
                <input
                  ref={sourceSearchRef}
                  type="search"
                  value={sourceQuery}
                  onChange={(event) => {
                    setSourceQuery(event.target.value)
                    setSourceVisibleCount(12)
                  }}
                  placeholder="Item name or ID"
                  aria-label="Search essentia sources"
                />
                {sourceQuery && (
                  <button
                    type="button"
                    aria-label="Clear source search"
                    onClick={() => {
                      setSourceQuery('')
                      setSourceVisibleCount(12)
                      sourceSearchRef.current?.focus()
                    }}
                  >
                    ×
                  </button>
                )}
              </label>
              {sourceQuery && (
                <p>
                  {sourceSearching
                    ? 'Searching…'
                    : `${sourceMatches.length.toLocaleString('en-US')} found`}
                </p>
              )}
              <div className="ess-source-list">
                {sourceMatches.slice(0, sourceVisibleCount).map((item) => (
                  <div className="ess-source-row" key={itemKey(item)}>
                    <ItemIcon item={item} />
                    <div>
                      <strong>{displayItemName(item.name)}</strong>
                      <small>
                        {Object.entries(item.aspects)
                          .filter(([aspect]) => required[aspect])
                          .map(([aspect, amount]) => `${aspectLabel(aspect)} ${amount}`)
                          .join(' · ')}
                        {item.aspectVersion ? ` · GTNH ${item.aspectVersion}` : ''}
                      </small>
                    </div>
                    <button
                      type="button"
                      disabled={preferences.excluded.has(itemKey(item))}
                      onClick={() => chooseItem(item)}
                    >
                      {countForItem(item, required)} {itemWord(countForItem(item, required) ?? 0)} →
                    </button>
                  </div>
                ))}
              </div>
              {sourceSearching && sourceMatches.length === 0 && <p>Searching sources…</p>}
              {!sourceSearching && sourceMatches.length === 0 && (
                <p>No matches. Try another name or ID.</p>
              )}
              <div className="ess-source-footer">
                {sourceVisibleCount < sourceMatches.length && (
                  <button
                    type="button"
                    onClick={() => setSourceVisibleCount((count) => count + 12)}
                  >
                    Show 12 more
                  </button>
                )}
                <button type="button" onClick={openCatalogSearch}>
                  Open full catalog ↓
                </button>
              </div>
            </div>
          )}
        </div>
      )}{' '}
    </>
  )
}
