'use client'

import type { useAspectAvailability } from '@/features/research-map/availability/useAspectAvailability'
import { AspectIcon, MinusIcon, PlusIcon, SettingsIcon } from '@/features/research-map/icons'
import { addonEntries, aspectLabel as label } from '@/features/research-map/model/catalog'
import type { Catalog } from '@/features/research-map/model/types'

export function AspectSettings({
  catalog,
  controller,
  isSolving,
}: {
  catalog: Catalog
  controller: ReturnType<typeof useAspectAvailability>
  isSolving: boolean
}) {
  const {
    aspectsOpen,
    setAspectsOpen,
    unavailableCount,
    enabled,
    activeAddons,
    toggleAddon,
    selectAllAspects,
    deselectAllAspects,
    toggleAvailableAspect,
  } = controller
  return (
    <section className="panel aspect-settings" inert={isSolving}>
      <button
        className="settings-toggle"
        type="button"
        aria-expanded={aspectsOpen}
        onClick={() => setAspectsOpen((current) => !current)}
      >
        <span>
          <SettingsIcon />
          <strong>Available Aspects</strong>
          {unavailableCount > 0 && <small>{unavailableCount} excluded</small>}
        </span>
        {aspectsOpen ? <MinusIcon /> : <PlusIcon />}
      </button>
      {aspectsOpen && (
        <div className="settings-content">
          <div className="inventory-header">
            <div className="inventory-actions">
              <button type="button" onClick={selectAllAspects}>
                Select all
              </button>
              <button type="button" onClick={deselectAllAspects}>
                Deselect all
              </button>
            </div>
          </div>
          <div className="addons">
            {addonEntries.map(([id, addon]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={activeAddons.has(id)}
                  onChange={() => toggleAddon(id)}
                />{' '}
                <span>{addon.name}</span>
              </label>
            ))}
          </div>
          <div className="aspect-grid">
            {catalog.aspects.map((aspect) => {
              const available = enabled.has(aspect)
              const parts = catalog.combinations[aspect]
              return (
                <button
                  className={`aspect-card ${available ? '' : 'is-disabled'}`}
                  type="button"
                  aria-pressed={available}
                  key={aspect}
                  onClick={() => toggleAvailableAspect(aspect)}
                  title={parts ? `${label(parts[0])} + ${label(parts[1])}` : 'Primal aspect'}
                >
                  <AspectIcon aspect={aspect} muted={!available} />
                  <span>{label(aspect)}</span>
                  <small>{aspect}</small>
                  {parts && <em>{parts.map(label).join(' + ')}</em>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
