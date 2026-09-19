import { AspectIcon } from '../../components/AspectIcon'
import { aspectLabel } from '../../lib/catalog'

export function AspectPalette({ aspects, query, onQueryChange }: {
  aspects: string[]
  query: string
  onQueryChange: (query: string) => void
}) {
  return <aside className="board-palette">
    <div><p className="eyebrow">Palette</p><h2>Aspects</h2></div>
    <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search aspects…" aria-label="Search aspects for the map" />
    <p className="palette-help">Drag an aspect onto a free cell.</p>
    <div className="palette-list">{aspects.map((aspect) => <button type="button" draggable onDragStart={(event) => event.dataTransfer.setData('text/aspect', aspect)} key={aspect}><AspectIcon aspect={aspect} /><span>{aspectLabel(aspect)}</span><small>{aspect}</small></button>)}</div>
  </aside>
}
