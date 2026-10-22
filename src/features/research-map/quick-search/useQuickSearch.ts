'use client'

import { useCallback, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { findAspectPath } from '@/features/research-map/model/aspectGraph'
import type { Catalog } from '@/features/research-map/model/types'
import type { ResearchSession } from '@/features/research-map/state/researchSession'

type QuickSearchValues = {
  from: string
  to: string
  minSpaces: number
}

export function useQuickSearch(
  initial: ResearchSession | null,
  catalog: Catalog,
  enabled: Set<string>,
) {
  const quickForm = useForm<QuickSearchValues>({
    defaultValues: {
      from: initial?.from ?? 'air',
      to: initial?.to ?? 'air',
      minSpaces: initial?.minSpaces ?? 1,
    },
  })
  const [from, to, minSpaces] = useWatch({
    control: quickForm.control,
    name: ['from', 'to', 'minSpaces'],
  })
  const [result, setResult] = useState<string[] | null>(initial?.result ?? null)
  const [searched, setSearched] = useState(initial?.searched ?? false)

  const restoreQuickSearch = useCallback(
    (saved: ResearchSession) => {
      quickForm.reset({ from: saved.from, to: saved.to, minSpaces: saved.minSpaces })
      setResult(saved.result)
      setSearched(saved.searched)
    },
    [quickForm.reset],
  )

  const runSearch = ({ from, to, minSpaces }: QuickSearchValues) => {
    setResult(
      findAspectPath(from, to, minSpaces, catalog.combinations, enabled, catalog.aspectWeights),
    )
    setSearched(true)
  }

  const swapAspects = () => {
    const { from, to } = quickForm.getValues()
    quickForm.setValue('from', to)
    quickForm.setValue('to', from)
  }

  const used = result
    ? result.slice(1, -1).reduce<Record<string, number>>((total, aspect) => {
        total[aspect] = (total[aspect] ?? 0) + 1
        return total
      }, {})
    : {}

  return {
    quickForm,
    from,
    to,
    minSpaces,
    result,
    searched,
    used,
    restoreQuickSearch,
    runSearch,
    swapAspects,
  }
}
