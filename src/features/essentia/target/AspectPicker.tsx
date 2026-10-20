'use client'

import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { AspectIcon } from '@/features/essentia/shared/AspectVisuals'
import { aspectLabel } from '@/features/essentia/shared/format'
import { Chevron } from '@/features/essentia/shared/icons'

export function AspectPicker({
  value,
  aspects,
  excluded,
  onChange,
}: {
  value: string
  aspects: string[]
  excluded: Set<string>
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(!value)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const options = aspects.filter(
    (aspect) =>
      (aspect === value || !excluded.has(aspect)) &&
      aspect.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  )

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const choose = (aspect: string) => {
    onChange(aspect)
    setOpen(false)
    setQuery('')
    setHighlight(0)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((index) => Math.min(Math.max(0, options.length - 1), index + 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((index) => Math.max(0, index - 1))
    }
    if (event.key === 'Enter' && options[highlight]) {
      event.preventDefault()
      choose(options[highlight])
    }
  }

  return (
    <div className="ess-picker" ref={rootRef}>
      <button
        className="ess-picker-trigger"
        type="button"
        aria-label={value ? `Choose aspect, currently ${aspectLabel(value)}` : 'Choose aspect'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {value ? (
          <AspectIcon name={value} />
        ) : (
          <span className="ess-picker-placeholder-icon">+</span>
        )}
        <span>{value ? aspectLabel(value) : 'Choose aspect'}</span>
        <Chevron />
      </button>
      {open && (
        <div className="ess-picker-popover">
          <label className="ess-picker-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setHighlight(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Search aspects…"
              aria-label="Search aspects"
            />
          </label>
          <div className="ess-picker-list" role="listbox" aria-label="Aspects">
            {options.map((aspect, index) => (
              <button
                type="button"
                role="option"
                aria-selected={aspect === value}
                className={index === highlight ? 'is-highlighted' : ''}
                key={aspect}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(aspect)}
              >
                <AspectIcon name={aspect} />
                <span>{aspectLabel(aspect)}</span>
                {aspect === value && <b>✓</b>}
              </button>
            ))}
            {options.length === 0 && <p>No aspects found</p>}
          </div>
        </div>
      )}
    </div>
  )
}
