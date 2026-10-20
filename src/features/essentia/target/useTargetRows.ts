'use client'

import { useMemo } from 'react'
import type { Requirement } from '@/features/essentia/model/planner'
import type { Catalog, Row } from '@/features/essentia/model/types'
import type { usePlannerSession } from '@/features/essentia/state/usePlannerSession'

export function useTargetRows(
  session: ReturnType<typeof usePlannerSession>,
  catalog: Catalog | null,
) {
  const { rows, setRows, nextId, setNextId, setSelectedId, setCustomLines } = session
  const required = useMemo(
    () =>
      rows.reduce<Requirement>((result, row) => {
        const amount = Number(row.amount)
        if (row.aspect && amount > 0) result[row.aspect] = (result[row.aspect] ?? 0) + amount
        return result
      }, {}),
    [rows],
  )
  const requestedAspects = useMemo(() => Object.keys(required), [required])
  const requestedTotal = Object.values(required).reduce((sum, amount) => sum + amount, 0)
  const availableAspects = catalog?.aspects.filter((aspect) => !/^custom\d+$/i.test(aspect)) ?? [
    'ignis',
    'potentia',
  ]
  const usedAspects = new Set(rows.map((row) => row.aspect))
  const updateRow = (id: number, change: Partial<Row>) =>
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...change } : row)))
  const changeAmount = (id: number, value: string) => {
    if (!/^\d{0,4}$/.test(value)) return
    updateRow(id, { amount: value && Number(value) > 1000 ? '1000' : value })
  }
  const stepAmount = (row: Row, direction: number) =>
    updateRow(row.id, {
      amount: String(Math.max(0, Math.min(1000, (Number(row.amount) || 0) + direction))),
    })
  const addRow = () => {
    if (rows.some((row) => !row.aspect) || rows.length >= availableAspects.length) return
    setRows((previous) => [...previous, { id: nextId, aspect: '', amount: '1' }])
    setNextId((value) => value + 1)
  }
  const removeRow = (id: number) => {
    setRows((previous) => previous.filter((row) => row.id !== id))
    if (rows.length === 1) {
      setSelectedId(null)
      setCustomLines([])
    }
  }
  return {
    required,
    requestedAspects,
    requestedTotal,
    availableAspects,
    usedAspects,
    updateRow,
    changeAmount,
    stepAmount,
    addRow,
    removeRow,
  }
}
