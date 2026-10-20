'use client'

import type { KeyboardEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { Chevron } from '@/features/essentia/shared/icons'

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[][]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const selectedIndex = Math.max(
    0,
    options.findIndex(([option]) => option === value),
  )

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    if (event.key === 'Tab' && open) setOpen(false)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setHighlight(selectedIndex)
        setOpen(true)
      } else
        setHighlight((index) =>
          Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
        )
    }
    if (open && event.key === 'Home') {
      event.preventDefault()
      setHighlight(0)
    }
    if (open && event.key === 'End') {
      event.preventDefault()
      setHighlight(options.length - 1)
    }
    if (open && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      choose(options[highlight][0])
    }
  }

  return (
    <div className="custom-select" ref={rootRef}>
      <button
        ref={triggerRef}
        className="custom-select-trigger"
        type="button"
        aria-label={`${label}, ${options[selectedIndex][1]}`}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open}
        onKeyDown={onKeyDown}
        onClick={() => {
          setHighlight(selectedIndex)
          setOpen((current) => !current)
        }}
      >
        <span>{options[selectedIndex][1]}</span>
        <Chevron />
      </button>
      {open && (
        <div className="custom-select-menu" id={listId} role="listbox" aria-label={label}>
          {options.map(([option, text], index) => (
            <button
              type="button"
              role="option"
              id={`${listId}-${index}`}
              aria-selected={value === option}
              className={index === highlight ? 'is-highlighted' : ''}
              key={option}
              onKeyDown={onKeyDown}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(option)}
            >
              <span>{text}</span>
              {value === option && (
                <span className="custom-select-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
