'use client'

import { ItemIcon } from '@/features/essentia/shared/ItemIcon'
import { StarIcon, UnavailableIcon } from '@/features/essentia/shared/icons'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'

export function SavedSources({
  controller,
}: {
  controller: ReturnType<typeof useEssentiaPlanner>['catalog']
}) {
  const {
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
  } = controller
  return (
    <>
      {(availability.preferred.length > 0 || availability.excluded.length > 0) && (
        <div className="ess-availability-panel">
          <strong className="ess-preferences-title">Your items</strong>
          <div className="ess-preferences-choices">
            <button
              className={`ess-preference-choice is-favorite${sourcesOpen && sourcesFilter === 'favorite' ? ' is-active' : ''}`}
              type="button"
              aria-expanded={sourcesOpen && sourcesFilter === 'favorite'}
              onClick={() => {
                setSourcesOpen(sourcesFilter === 'favorite' ? !sourcesOpen : true)
                if (sourcesFilter !== 'favorite') setSourcesQuery('')
                setSourcesFilter('favorite')
                setSourcesVisibleCount(30)
              }}
            >
              <StarIcon filled />
              <span>Favorites</span>
              <strong>{availability.preferred.length}</strong>
            </button>
            <button
              className={`ess-preference-choice is-unavailable${sourcesOpen && sourcesFilter === 'excluded' ? ' is-active' : ''}`}
              type="button"
              aria-expanded={sourcesOpen && sourcesFilter === 'excluded'}
              onClick={() => {
                setSourcesOpen(sourcesFilter === 'excluded' ? !sourcesOpen : true)
                if (sourcesFilter !== 'excluded') setSourcesQuery('')
                setSourcesFilter('excluded')
                setSourcesVisibleCount(30)
              }}
            >
              <UnavailableIcon />
              <span>Unavailable</span>
              <strong>{availability.excluded.length}</strong>
            </button>
          </div>
          {sourcesOpen && (
            <div className="ess-source-manager-body">
              <label className="ess-source-manager-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={sourcesQuery}
                  onChange={(event) => {
                    setSourcesQuery(event.target.value)
                    setSourcesVisibleCount(30)
                  }}
                  placeholder={`Search ${sourcesFilter === 'favorite' ? 'favorites' : 'unavailable items'}`}
                  aria-label="Search saved sources"
                />
              </label>
              <div className="ess-source-manager-list">
                {managedSources.slice(0, sourcesVisibleCount).map(({ id, kind, item, name }) => (
                  <div className="ess-source-manager-row" key={`${kind}-${id}`}>
                    {item ? (
                      <ItemIcon item={item} />
                    ) : (
                      <span className="ess-item-icon" aria-hidden="true">
                        ?
                      </span>
                    )}
                    <div>
                      <strong title={name}>{name}</strong>
                      {item?.registryId && <small title={item.registryId}>{item.registryId}</small>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeManagedSource(id, kind)}
                      aria-label={
                        kind === 'favorite'
                          ? `Remove ${name} from favorites`
                          : `Restore ${name} to recommendations`
                      }
                    >
                      {kind === 'favorite' ? 'Remove' : 'Restore'}
                    </button>
                  </div>
                ))}
              </div>
              {managedSources.length === 0 && (
                <p className="ess-source-manager-empty">
                  {sourcesQuery
                    ? 'No matching items.'
                    : `No ${sourcesFilter === 'favorite' ? 'favorites' : 'unavailable items'} yet.`}
                </p>
              )}
              {sourcesVisibleCount < managedSources.length && (
                <button
                  className="ess-source-manager-more"
                  type="button"
                  onClick={() => setSourcesVisibleCount((count) => count + 30)}
                >
                  Show 30 more ↓
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
