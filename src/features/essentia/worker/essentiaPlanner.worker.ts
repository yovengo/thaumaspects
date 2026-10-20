import type { ItemAspect, Plan, Requirement } from '@/features/essentia/model/planner'
import { buildPlans, itemEffort, itemSimplicity, key } from '@/features/essentia/model/planner'

type Calculation =
  | { type: 'init'; items: ItemAspect[] }
  | {
      type: 'calculate'
      request: string
      required: Requirement
      preferences: { preferred: string[]; excluded: string[]; stage: string }
    }
  | {
      type: 'catalog'
      request: string
      required: Requirement
      query: string
      filter: 'allSelected' | 'anySelected' | 'allItems'
      sort: 'practical' | 'quantity' | 'name'
      preferences: { preferred: string[]; excluded: string[]; stage: string }
    }
  | {
      type: 'sources'
      request: string
      aspects: string[]
      query: string
      preferences: { preferred: string[]; excluded: string[]; stage: string }
    }

let items: ItemAspect[] = []
let indices: number[] = []
let itemByKey = new Map<string, ItemAspect>()
const displayName = (name: string) => name.replace(/§[0-9a-fk-or]/gi, '')
const searchRank = (name: string, query: string) => {
  const normalized = displayName(name).toLocaleLowerCase()
  return normalized === query ? 0 : normalized.startsWith(query) ? 1 : 2
}
const countForItem = (item: ItemAspect, required: Requirement, aspects: string[]) =>
  aspects.length
    ? Math.max(
        ...aspects.map((aspect) => Math.ceil(required[aspect] / (item.aspects[aspect] ?? 0))),
      )
    : Infinity

function sortPreference(
  a: ItemAspect,
  b: ItemAspect,
  preferred: Set<string>,
  excluded: Set<string>,
) {
  const preferredOrder = preferred.size
    ? Number(preferred.has(key(b))) - Number(preferred.has(key(a)))
    : 0
  if (preferredOrder) return preferredOrder
  return excluded.size ? Number(excluded.has(key(a))) - Number(excluded.has(key(b))) : 0
}

self.onmessage = (event: MessageEvent<Calculation>) => {
  if (event.data.type === 'init') {
    items = event.data.items
    indices = items.map((_, index) => index)
    itemByKey = new Map(items.map((item) => [key(item), item]))
    return
  }
  const task = event.data
  const { request, preferences } = task
  const preferred = new Set(preferences.preferred)
  const excluded = new Set(preferences.excluded)
  const ranking = { preferred, excluded, stage: preferences.stage }
  if (task.type === 'calculate') {
    try {
      let favoritePlan: Plan | undefined
      if (preferred.size > 0) {
        const favoriteItems = [...preferred]
          .map((id) => itemByKey.get(id))
          .filter((item): item is ItemAspect => item !== undefined && !excluded.has(key(item)))
        const aspects = Object.keys(task.required)
        const covered = aspects.every((aspect) =>
          favoriteItems.some((item) => (item.aspects[aspect] ?? 0) > 0),
        )
        if (covered) {
          const previewItems = new Set<ItemAspect>()
          for (const aspect of aspects) {
            const candidates = favoriteItems
              .filter((item) => (item.aspects[aspect] ?? 0) > 0)
              .sort((a, b) => {
                const score = (item: ItemAspect) => {
                  const useful = Math.min(task.required[aspect], item.aspects[aspect])
                  const excess = Object.entries(item.aspects).reduce(
                    (sum, [name, amount]) => sum + Math.max(0, amount - (task.required[name] ?? 0)),
                    0,
                  )
                  return (itemEffort(item, ranking) + excess * 0.2) / useful
                }
                return score(a) - score(b) || a.name.localeCompare(b.name)
              })
              .slice(0, 8)
            for (const item of candidates) previewItems.add(item)
          }
          favoritePlan = buildPlans([...previewItems], task.required, ranking)[0]
          if (favoritePlan)
            self.postMessage({ type: 'calculate', request, plans: [favoritePlan], partial: true })
        }
      }
      self.postMessage({
        type: 'calculate',
        request,
        plans: buildPlans(items, task.required, ranking, favoritePlan),
      })
    } catch {
      self.postMessage({ type: 'calculate', request, plans: [], error: true })
    }
    return
  }
  const query = task.query.trim().toLocaleLowerCase()
  if (task.type === 'sources') {
    const matches = indices
      .filter((index) => {
        const item = items[index]
        return (
          task.aspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0) &&
          (!query ||
            `${displayName(item.name)} ${item.registryId ?? ''}`
              .toLocaleLowerCase()
              .includes(query))
        )
      })
      .sort((a, b) => {
        const first = items[a],
          second = items[b]
        return (
          (query ? searchRank(first.name, query) - searchRank(second.name, query) : 0) ||
          sortPreference(first, second, preferred, excluded) ||
          itemSimplicity(first, ranking) - itemSimplicity(second, ranking) ||
          first.name.localeCompare(second.name)
        )
      })
    self.postMessage({ type: 'sources', request, indices: matches })
    return
  }
  const aspects = Object.keys(task.required)
  const matches = indices
    .filter((index) => {
      const item = items[index]
      if (
        query &&
        !`${displayName(item.name)} ${item.registryId ?? ''}`.toLocaleLowerCase().includes(query)
      )
        return false
      if (task.filter === 'allItems' || aspects.length === 0) return true
      return task.filter === 'allSelected'
        ? aspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)
        : aspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0)
    })
    .sort((a, b) => {
      const first = items[a],
        second = items[b]
      const relevance = query ? searchRank(first.name, query) - searchRank(second.name, query) : 0
      if (relevance) return relevance
      const preference = sortPreference(first, second, preferred, excluded)
      if (preference) return preference
      if (task.sort === 'name')
        return displayName(first.name).localeCompare(displayName(second.name))
      const firstCount = aspects.every((aspect) => (first.aspects[aspect] ?? 0) > 0)
        ? countForItem(first, task.required, aspects)
        : Infinity
      const secondCount = aspects.every((aspect) => (second.aspects[aspect] ?? 0) > 0)
        ? countForItem(second, task.required, aspects)
        : Infinity
      if (task.sort === 'quantity')
        return (
          firstCount - secondCount ||
          itemSimplicity(first, ranking) - itemSimplicity(second, ranking) ||
          first.name.localeCompare(second.name)
        )
      const firstCoverage = aspects.filter((aspect) => (first.aspects[aspect] ?? 0) > 0).length
      const secondCoverage = aspects.filter((aspect) => (second.aspects[aspect] ?? 0) > 0).length
      return (
        itemSimplicity(first, ranking) / Math.max(1, firstCoverage) -
          itemSimplicity(second, ranking) / Math.max(1, secondCoverage) ||
        secondCoverage - firstCoverage ||
        firstCount - secondCount ||
        first.name.localeCompare(second.name)
      )
    })
  self.postMessage({ type: 'catalog', request, indices: matches })
}
