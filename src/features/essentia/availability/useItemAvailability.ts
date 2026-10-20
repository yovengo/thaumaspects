'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { availabilityEvent, availabilityKey } from '@/features/auth/availabilityStorage'
import { stages } from '@/features/essentia/availability/stages'
import { type ItemAspect, key as itemKey } from '@/features/essentia/model/planner'
import type { Availability } from '@/features/essentia/model/types'

const defaultAvailability: Availability = { preferred: [], excluded: [], stage: 'NONE' }

function parseAvailability(raw: string): Availability {
  try {
    const stored = JSON.parse(raw || '{}') as Partial<Availability>
    return {
      preferred: Array.isArray(stored.preferred)
        ? stored.preferred.filter((value): value is string => typeof value === 'string')
        : [],
      excluded: Array.isArray(stored.excluded)
        ? stored.excluded.filter((value): value is string => typeof value === 'string')
        : [],
      stage: stages.some(([value]) => value === stored.stage) ? stored.stage! : 'NONE',
    }
  } catch {
    return defaultAvailability
  }
}

function availabilitySnapshot() {
  try {
    return window.localStorage.getItem(availabilityKey) ?? ''
  } catch {
    return ''
  }
}

function subscribeAvailability(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(availabilityEvent, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(availabilityEvent, onChange)
  }
}

export function useItemAvailability() {
  const stored = useSyncExternalStore(subscribeAvailability, availabilitySnapshot, () => '')
  const saved = useMemo(() => parseAvailability(stored), [stored])
  const [volatile, setVolatile] = useState<Availability | null>(null)
  const availability = volatile ?? saved
  const { availabilityChanged } = useAuth()

  const setAvailability = (update: Availability | ((current: Availability) => Availability)) => {
    const next = typeof update === 'function' ? update(availability) : update
    try {
      window.localStorage.setItem(availabilityKey, JSON.stringify(next))
      availabilityChanged(availability, next)
      setVolatile(null)
      window.dispatchEvent(new Event(availabilityEvent))
    } catch {
      setVolatile(next)
    }
  }

  const preferItem = (item: ItemAspect) => {
    const id = itemKey(item)
    setAvailability((previous) => ({
      stage: previous.stage,
      preferred: previous.preferred.includes(id)
        ? previous.preferred.filter((value) => value !== id)
        : [...previous.preferred, id],
      excluded: previous.excluded.filter((value) => value !== id),
    }))
  }
  const excludeItem = (item: ItemAspect) => {
    const id = itemKey(item)
    setAvailability((previous) => ({
      stage: previous.stage,
      preferred: previous.preferred.filter((value) => value !== id),
      excluded: previous.excluded.includes(id) ? previous.excluded : [...previous.excluded, id],
    }))
  }
  const restoreItem = (item: ItemAspect) => {
    const id = itemKey(item)
    setAvailability((previous) => ({
      ...previous,
      excluded: previous.excluded.filter((value) => value !== id),
    }))
  }
  const removeManagedSource = (id: string, kind: 'favorite' | 'excluded') => {
    setAvailability((previous) =>
      kind === 'favorite'
        ? { ...previous, preferred: previous.preferred.filter((value) => value !== id) }
        : { ...previous, excluded: previous.excluded.filter((value) => value !== id) },
    )
  }

  return {
    availability,
    setAvailability,
    preferItem,
    excludeItem,
    restoreItem,
    removeManagedSource,
  }
}
