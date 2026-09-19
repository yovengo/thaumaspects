import type { Catalog, Mode } from '../types/domain'
import { AspectSelect } from './AspectSelect'
import { VersionSelect } from './VersionSelect'

export function SearchPanel({ mode, version, catalog, from, to, minSpaces, onModeChange, onVersionChange, onFromChange, onToChange, onMinSpacesChange, onSearch }: {
  mode: Mode
  version: string
  catalog: Catalog
  from: string
  to: string
  minSpaces: number
  onModeChange: (mode: Mode) => void
  onVersionChange: (version: string) => void
  onFromChange: (aspect: string) => void
  onToChange: (aspect: string) => void
  onMinSpacesChange: (spaces: number) => void
  onSearch: () => void
}) {
  return <div className="panel search-panel">
    <div className="panel-heading"><span className="step-number">1</span><div><h2>Set up your search</h2><p>Your game version and two aspects from the note.</p></div></div>
    <div className="mode-switch" role="group" aria-label="Work mode"><button type="button" className={mode === 'quick' ? 'is-active' : ''} onClick={() => onModeChange('quick')}>Quick search</button><button type="button" className={mode === 'board' ? 'is-active' : ''} onClick={() => onModeChange('board')}>Research map</button></div>
    <VersionSelect value={version} onChange={onVersionChange} />
    {mode === 'quick' && <div className="aspect-selects">
      <AspectSelect caption="From" value={from} aspects={catalog.aspects} onChange={onFromChange} />
      <button className="swap-aspects" type="button" onClick={() => { onFromChange(to); onToChange(from) }} aria-label="Swap aspects" title="Swap aspects">⇄</button>
      <AspectSelect caption="To" value={to} aspects={catalog.aspects} onChange={onToChange} />
    </div>}
    <label className="field-label">Empty spaces between aspects: <strong>{minSpaces}</strong>
      <input type="range" min="1" max="10" value={minSpaces} onChange={(event) => onMinSpacesChange(Number(event.target.value))} />
    </label>
    {mode === 'quick'
      ? <button className="find-button" type="button" onClick={onSearch}>Find connection <span>→</span></button>
      : <div className="board-instructions"><strong>1.</strong> Paste a screenshot or drag aspects. <strong>2.</strong> Check the map. <strong>3.</strong> Auto-connect.</div>}
  </div>
}
