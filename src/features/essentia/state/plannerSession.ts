import type { PlannerSession } from '@/features/essentia/model/types'

const plannerSessionKey = 'thaumaspects:planner-session:v1'
let plannerSessionCache: PlannerSession | null = null

export const getCachedPlannerSession = () => plannerSessionCache

export function readPlannerSession(): PlannerSession | null {
  try {
    const raw = window.sessionStorage.getItem(plannerSessionKey)
    if (!raw) return null
    const saved = JSON.parse(raw) as PlannerSession
    if (
      !Array.isArray(saved.rows) ||
      !saved.rows.every((row) => Number.isInteger(row.id) && typeof row.aspect === 'string') ||
      !Array.isArray(saved.customLines) ||
      !saved.customLines.every((line) => line?.item?.aspects && line.count > 0) ||
      !Array.isArray(saved.expandedItems) ||
      !Number.isInteger(saved.nextId)
    )
      return null
    return saved
  } catch {
    return null
  }
}

export function savePlannerSession(saved: PlannerSession) {
  plannerSessionCache = saved
  try {
    window.sessionStorage.setItem(plannerSessionKey, JSON.stringify(saved))
  } catch {
    return
  }
}
