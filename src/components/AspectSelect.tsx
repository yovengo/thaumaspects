import { useState } from 'react'
import { aspectLabel } from '../lib/catalog'
import { AspectIcon } from './AspectIcon'

export function AspectSelect({ caption, value, aspects, onChange }: {
  caption: string
  value: string
  aspects: string[]
  onChange: (aspect: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const matches = aspects.filter((aspect) => `${aspectLabel(aspect)} ${aspect}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))

  const selectAspect = (aspect: string) => {
    onChange(aspect)
    setOpen(false)
    setQuery('')
  }

  return <div className="field-label aspect-picker"><span>{caption}</span>
    <button className="aspect-picker-trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}><AspectIcon aspect={value} /><span>{aspectLabel(value)}</span><small>{value}</small><b aria-hidden="true">⌄</b></button>
    {open && <div className="aspect-picker-menu"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search aspects…" autoFocus aria-label={`Search aspects for ${caption}`} />
      <div className="aspect-picker-options" role="listbox">{matches.map((aspect) => <button type="button" role="option" aria-selected={aspect === value} key={aspect} onClick={() => selectAspect(aspect)}><AspectIcon aspect={aspect} /><span>{aspectLabel(aspect)}</span><small>{aspect}</small></button>)}{matches.length === 0 && <p>No aspects found</p>}</div>
    </div>}
  </div>
}
