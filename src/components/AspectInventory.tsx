import { addonEntries, aspectLabel } from '../lib/catalog'
import type { Catalog } from '../types/domain'
import { AspectIcon } from './AspectIcon'

export function AspectInventory({ catalog, enabled, activeAddons, onToggleAspect, onToggleAddon, onSelectAll, onDeselectAll }: {
  catalog: Catalog
  enabled: Set<string>
  activeAddons: Set<string>
  onToggleAspect: (aspect: string) => void
  onToggleAddon: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}) {
  return <section className="panel inventory-panel">
    <div className="inventory-header"><div className="panel-heading"><span className="step-number">3</span><div><h2>Available aspects</h2><p>Click an aspect to exclude it from the search.</p></div></div><div className="inventory-actions"><button type="button" onClick={onSelectAll}>Select all</button><button type="button" onClick={onDeselectAll}>Deselect all</button></div></div>
    <div className="addons">{addonEntries.map(([id, addon]) => <label key={id}><input type="checkbox" checked={activeAddons.has(id)} onChange={() => onToggleAddon(id)} /> <span>{addon.name}</span></label>)}</div>
    <div className="aspect-grid">{catalog.aspects.map((aspect) => {
      const available = enabled.has(aspect)
      const parts = catalog.combinations[aspect]
      return <button className={`aspect-card ${available ? '' : 'is-disabled'}`} type="button" key={aspect} onClick={() => onToggleAspect(aspect)} title={parts ? `${aspectLabel(parts[0])} + ${aspectLabel(parts[1])}` : 'Primal aspect'}><AspectIcon aspect={aspect} muted={!available} /><span>{aspectLabel(aspect)}</span><small>{aspect}</small>{parts && <em>{parts.map(aspectLabel).join(' + ')}</em>}</button>
    })}</div>
  </section>
}
