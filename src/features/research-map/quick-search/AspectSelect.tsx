'use client'

import { useEffect, useRef, useState } from 'react'
import { AspectIcon, ChevronDownIcon } from '@/features/research-map/icons'
import { aspectLabel } from '@/features/research-map/model/catalog'

export function AspectSelect({
  caption,
  value,
  aspects,
  onChange,
}: {
  caption: string
  value: string
  aspects: string[]
  onChange: (aspect: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])
  const matches = aspects.filter((aspect) =>
    `${aspectLabel(aspect)} ${aspect}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  )

  const selectAspect = (aspect: string) => {
    onChange(aspect)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="field-label aspect-picker">
      <span>{caption}</span>
      <button
        className="aspect-picker-trigger"
        type="button"
        aria-label={`Choose ${caption.toLowerCase()} aspect, currently ${aspectLabel(value)}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <AspectIcon aspect={value} />
        <span>{aspectLabel(value)}</span>
        <small>{value}</small>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="aspect-picker-menu">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'Enter') {
                event.preventDefault()
                if (matches[0]) selectAspect(matches[0])
              }
            }}
            placeholder="Search aspects…"
            aria-label={`Search aspects for ${caption}`}
          />
          <div className="aspect-picker-options" role="listbox">
            {matches.map((aspect) => (
              <button
                type="button"
                role="option"
                aria-selected={aspect === value}
                key={aspect}
                onClick={() => selectAspect(aspect)}
              >
                <AspectIcon aspect={aspect} />
                <span>{aspectLabel(aspect)}</span>
                <small>{aspect}</small>
              </button>
            ))}
            {matches.length === 0 && <p>No aspects found</p>}
          </div>
        </div>
      )}
    </div>
  )
}
