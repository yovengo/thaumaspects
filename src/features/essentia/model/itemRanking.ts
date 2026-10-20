import type { ItemAspect, PlannerPreferences } from './plannerTypes.ts'

const effortCache = new WeakMap<ItemAspect, Map<string, number>>()
const keyCache = new WeakMap<ItemAspect, string>()

export function itemEffort(item: ItemAspect, preferences: PlannerPreferences = {}) {
  if (preferences.preferred?.size && preferences.preferred.has(key(item))) return 0.15
  const stage = preferences.stage ?? 'NONE'
  const cached = effortCache.get(item)?.get(stage)
  if (cached !== undefined) return cached
  const acquisition = item.acquisition?.[stage]
  const recipeScore = acquisition?.[0]
  if (recipeScore === undefined && item.acquisition) return 1000
  const concentration = Math.max(0, Math.max(...Object.values(item.aspects)) - 2)
  const effort =
    Math.max(0.15, recipeScore ?? 20) + (acquisition?.[1] ?? 0) * 4 + concentration * 1.5
  const scores = effortCache.get(item) ?? new Map<string, number>()
  scores.set(stage, effort)
  effortCache.set(item, scores)
  return effort
}

export const itemSimplicity = (item: ItemAspect, preferences: PlannerPreferences = {}) =>
  itemEffort(item, preferences)

export function key(item: ItemAspect) {
  const cached = keyCache.get(item)
  if (cached !== undefined) return cached
  const value = `${item.registryId ?? item.name}|${Object.entries(item.aspects)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([aspect, amount]) => `${aspect}:${amount}`)
    .join(',')}`
  keyCache.set(item, value)
  return value
}

export function prepareItems(items: ItemAspect[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.name || !Object.values(item.aspects).some((amount) => amount > 0)) return false
    const id = key(item)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}
