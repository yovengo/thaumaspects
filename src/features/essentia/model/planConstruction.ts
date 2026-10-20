import { itemEffort, itemSimplicity, key } from './itemRanking.ts'
import type { ItemAspect, Plan, PlanLine, PlannerPreferences, Requirement } from './plannerTypes.ts'
import { simplePlanCounts } from './practicalSearch.ts'

export function makePlan(
  items: ItemAspect[],
  required: Requirement,
  title: string,
  strategy: 'simple' | 'fewest' | 'clean',
  preferences: PlannerPreferences,
  initialCounts?: Map<ItemAspect, number>,
): Plan | null {
  const aspects = Object.keys(required).filter((aspect) => required[aspect] > 0)
  const candidates = items.filter(
    (item) =>
      !(preferences.excluded?.size && preferences.excluded.has(key(item))) &&
      itemEffort(item, preferences) < 1000 &&
      aspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0),
  )
  if (aspects.some((aspect) => !candidates.some((item) => (item.aspects[aspect] ?? 0) > 0)))
    return null

  const pool = candidates
  const remaining = { ...required }
  let counts =
    strategy === 'simple'
      ? simplePlanCounts(candidates, required, preferences, initialCounts)
      : null
  if (strategy === 'simple' && !counts) return null
  counts ??= new Map<ItemAspect, number>()
  const totalNeeded = Object.values(required).reduce((sum, value) => sum + value, 0)

  for (let step = 0; strategy !== 'simple' && step < Math.min(2048, totalNeeded + 8); step += 1) {
    if (aspects.every((aspect) => remaining[aspect] <= 0)) break
    let best: ItemAspect | null = null
    let bestScore = -Infinity

    for (const item of pool) {
      const gain = aspects.reduce(
        (sum, aspect) => sum + Math.min(remaining[aspect], item.aspects[aspect] ?? 0),
        0,
      )
      if (gain <= 0) continue
      const unwanted = Object.entries(item.aspects).reduce(
        (sum, [aspect, amount]) => sum + Math.max(0, amount - (remaining[aspect] ?? 0)),
        0,
      )
      const complexity = itemSimplicity(item, preferences)
      const cost =
        strategy === 'clean'
          ? 1 + complexity * 0.35 + unwanted * 2.5
          : 1 + complexity * 0.25 + unwanted * 0.12
      const score = gain / cost
      if (
        score > bestScore ||
        (score === bestScore && best && item.name.localeCompare(best.name) < 0)
      ) {
        best = item
        bestScore = score
      }
    }
    if (!best) return null
    counts.set(best, (counts.get(best) ?? 0) + 1)
    aspects.forEach((aspect) => {
      remaining[aspect] -= best.aspects[aspect] ?? 0
    })
  }
  if (strategy !== 'simple' && aspects.some((aspect) => remaining[aspect] > 0)) return null

  if (strategy === 'fewest') {
    const currentCount = [...counts.values()].reduce((sum, count) => sum + count, 0)
    let bestSingle: { item: ItemAspect; count: number; extra: number } | null = null
    for (const item of pool) {
      if (!aspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)) continue
      const count = Math.max(
        ...aspects.map((aspect) => Math.ceil(required[aspect] / item.aspects[aspect])),
      )
      if (count >= currentCount) continue
      const extra = Object.entries(item.aspects).reduce(
        (sum, [aspect, amount]) => sum + Math.max(0, amount * count - (required[aspect] ?? 0)),
        0,
      )
      if (
        !bestSingle ||
        count < bestSingle.count ||
        (count === bestSingle.count && extra < bestSingle.extra)
      )
        bestSingle = { item, count, extra }
    }
    if (bestSingle) counts = new Map([[bestSingle.item, bestSingle.count]])
  }

  const lines = [...counts]
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name))
  const produced: Requirement = {}
  for (const { item, count } of lines) {
    for (const [aspect, amount] of Object.entries(item.aspects)) {
      produced[aspect] = (produced[aspect] ?? 0) + amount * count
    }
  }
  return {
    id: lines
      .map(({ item, count }) => `${key(item)}×${count}`)
      .sort()
      .join(';'),
    title,
    lines,
    produced,
    remaining: Object.fromEntries(
      aspects.map((aspect) => [aspect, Math.max(0, required[aspect] - (produced[aspect] ?? 0))]),
    ),
    itemCount: lines.reduce((sum, line) => sum + line.count, 0),
    extra: Object.entries(produced).reduce(
      (sum, [aspect, amount]) => sum + Math.max(0, amount - (required[aspect] ?? 0)),
      0,
    ),
  }
}

export function planFromLines(lines: PlanLine[], required: Requirement, title = 'My mix'): Plan {
  const produced: Requirement = {}
  for (const { item, count } of lines) {
    for (const [aspect, amount] of Object.entries(item.aspects)) {
      produced[aspect] = (produced[aspect] ?? 0) + amount * count
    }
  }
  return {
    id: 'custom',
    title,
    lines,
    produced,
    remaining: Object.fromEntries(
      Object.entries(required).map(([aspect, amount]) => [
        aspect,
        Math.max(0, amount - (produced[aspect] ?? 0)),
      ]),
    ),
    itemCount: lines.reduce((sum, line) => sum + line.count, 0),
    extra: Object.entries(produced).reduce(
      (sum, [aspect, amount]) => sum + Math.max(0, amount - (required[aspect] ?? 0)),
      0,
    ),
  }
}
