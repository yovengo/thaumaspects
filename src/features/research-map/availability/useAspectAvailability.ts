'use client'

import { useCallback, useState } from 'react'
import { addonEntries, addonMap } from '@/features/research-map/model/catalog'
import type { Catalog } from '@/features/research-map/model/types'
import type { ResearchSession } from '@/features/research-map/state/researchSession'

export function useAspectAvailability(initial: ResearchSession | null, catalog: Catalog) {
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(initial?.enabled ?? catalog.aspects),
  )
  const [activeAddons, setActiveAddons] = useState<Set<string>>(
    () => new Set(initial?.activeAddons ?? addonEntries.map(([id]) => id)),
  )
  const [aspectsOpen, setAspectsOpen] = useState(initial?.aspectsOpen ?? false)

  const restoreAvailability = useCallback((saved: ResearchSession) => {
    setEnabled(new Set(saved.enabled))
    setActiveAddons(new Set(saved.activeAddons))
    setAspectsOpen(saved.aspectsOpen)
  }, [])

  const toggleAddon = (id: string) => {
    const addon = addonMap[id]
    const active = activeAddons.has(id)
    setActiveAddons((previous) => {
      const next = new Set(previous)
      if (active) next.delete(id)
      else next.add(id)
      return next
    })
    setEnabled((previous) => {
      const next = new Set(previous)
      addon.aspects.forEach((aspect) => {
        if (active) next.delete(aspect)
        else next.add(aspect)
      })
      return next
    })
  }

  const toggleAvailableAspect = (aspect: string) => {
    setEnabled((previous) => {
      const next = new Set(previous)
      if (next.has(aspect)) next.delete(aspect)
      else next.add(aspect)
      return next
    })
  }

  const selectAllAspects = () => {
    setEnabled(new Set(catalog.aspects))
    setActiveAddons(new Set(addonEntries.map(([id]) => id)))
  }

  const deselectAllAspects = () => {
    setEnabled(new Set())
    setActiveAddons(new Set())
  }

  return {
    enabled,
    activeAddons,
    aspectsOpen,
    setAspectsOpen,
    unavailableCount: catalog.aspects.length - enabled.size,
    restoreAvailability,
    toggleAddon,
    toggleAvailableAspect,
    selectAllAspects,
    deselectAllAspects,
  }
}
