import { itemEffort, key } from './itemRanking.ts'
import type { ItemAspect, PlannerPreferences, Requirement } from './plannerTypes.ts'

type SearchState = { remaining: Requirement; counts: Map<ItemAspect, number>; cost: number }

function additionCost(
  item: ItemAspect,
  count: number,
  remaining: Requirement,
  isNew: boolean,
  preferences: PlannerPreferences,
) {
  const useful = Object.entries(remaining).reduce(
    (sum, [aspect, amount]) =>
      sum + Math.min(Math.max(0, amount), (item.aspects[aspect] ?? 0) * count),
    0,
  )
  const total = Object.values(item.aspects).reduce((sum, amount) => sum + amount, 0) * count
  return itemEffort(item, preferences) * count + (total - useful) * 0.2 + (isNew ? 4 : 0)
}

function simplePool(
  candidates: ItemAspect[],
  required: Requirement,
  preferences: PlannerPreferences,
) {
  const aspects = Object.keys(required).filter((aspect) => required[aspect] > 0)
  const shortlist = aspects.flatMap((aspect) => {
    const relevant = candidates.filter((item) => (item.aspects[aspect] ?? 0) > 0)
    const byEffort = [...relevant]
      .sort(
        (a, b) =>
          itemEffort(a, preferences) - itemEffort(b, preferences) || a.name.localeCompare(b.name),
      )
      .slice(0, 40)
    const byYield = [...relevant]
      .sort((a, b) => {
        const rank = (item: ItemAspect) => {
          const useful = Math.min(required[aspect], item.aspects[aspect])
          const other = Object.entries(item.aspects).reduce(
            (sum, [name, amount]) => sum + Math.max(0, amount - (required[name] ?? 0)),
            0,
          )
          return (itemEffort(item, preferences) + other * 0.2) / useful
        }
        return rank(a) - rank(b) || a.name.localeCompare(b.name)
      })
      .slice(0, 40)
    return [...byEffort, ...byYield]
  })
  return [
    ...new Set([
      ...shortlist,
      ...(preferences.preferred?.size
        ? candidates.filter((item) => preferences.preferred?.has(key(item)))
        : []),
    ]),
  ]
}

export function simplePlanCounts(
  candidates: ItemAspect[],
  required: Requirement,
  preferences: PlannerPreferences,
  initialCounts?: Map<ItemAspect, number>,
): Map<ItemAspect, number> | null {
  const aspects = Object.keys(required).filter((aspect) => required[aspect] > 0)
  const pool = simplePool(candidates, required, preferences)
  if (aspects.some((aspect) => !pool.some((item) => (item.aspects[aspect] ?? 0) > 0))) return null
  const byAspect = new Map(
    aspects.map((aspect) => [aspect, pool.filter((item) => (item.aspects[aspect] ?? 0) > 0)]),
  )
  const orders = [
    [...aspects].sort(
      (a, b) => byAspect.get(a)!.length - byAspect.get(b)!.length || a.localeCompare(b),
    ),
    [...aspects].sort((a, b) => required[b] - required[a] || a.localeCompare(b)),
    [...aspects].sort((a, b) => required[a] - required[b] || a.localeCompare(b)),
  ]
  let seed: SearchState | null = null
  for (const order of orders) {
    const remaining = { ...required }
    const counts = new Map<ItemAspect, number>()
    let cost = 0
    for (const aspect of order) {
      if (remaining[aspect] <= 0) continue
      let choice: { item: ItemAspect; count: number; cost: number; score: number } | null = null
      for (const item of byAspect.get(aspect)!) {
        if (
          [...counts.keys()].some(
            (chosen) => chosen.name === item.name && key(chosen) !== key(item),
          )
        )
          continue
        const count = Math.ceil(remaining[aspect] / item.aspects[aspect])
        const gain = aspects.reduce(
          (sum, name) => sum + Math.min(remaining[name], (item.aspects[name] ?? 0) * count),
          0,
        )
        const addedCost = additionCost(item, count, remaining, !counts.has(item), preferences)
        const score = addedCost / gain
        if (
          !choice ||
          score < choice.score ||
          (score === choice.score && addedCost < choice.cost)
        ) {
          choice = { item, count, cost: addedCost, score }
        }
      }
      if (!choice) break
      counts.set(choice.item, (counts.get(choice.item) ?? 0) + choice.count)
      cost += choice.cost
      for (const name of aspects)
        remaining[name] = Math.max(
          0,
          remaining[name] - (choice.item.aspects[name] ?? 0) * choice.count,
        )
    }
    if (aspects.every((aspect) => remaining[aspect] === 0) && (!seed || cost < seed.cost)) {
      seed = { remaining, counts, cost }
    }
  }
  const minimumEffortPerAspect = new Map(
    aspects.map((aspect) => [
      aspect,
      Math.min(
        ...byAspect
          .get(aspect)!
          .map((item) => itemEffort(item, preferences) / item.aspects[aspect]),
      ),
    ]),
  )
  const lowerBound = (remaining: Requirement) =>
    Math.max(
      0,
      ...aspects.map((aspect) => {
        const amount = remaining[aspect]
        return amount <= 0 ? 0 : amount * minimumEffortPerAspect.get(aspect)!
      }),
    )
  const priority = (state: SearchState) => state.cost + lowerBound(state.remaining)
  let beam: SearchState[] = [{ remaining: { ...required }, counts: new Map(), cost: 0 }]
  let best: SearchState | null = seed
  if (initialCounts?.size) {
    const remaining = { ...required }
    let cost = 0
    for (const [item, count] of initialCounts) {
      cost += additionCost(item, count, remaining, true, preferences)
      for (const aspect of aspects)
        remaining[aspect] = Math.max(0, remaining[aspect] - (item.aspects[aspect] ?? 0) * count)
    }
    if (aspects.every((aspect) => remaining[aspect] === 0) && (!best || cost < best.cost))
      best = { remaining, counts: initialCounts, cost }
  }
  const width = aspects.length <= 4 ? 80 : 32
  const depthLimit = Math.min(20, aspects.length * 4 + 4)

  for (let depth = 0; depth < depthLimit && beam.length; depth += 1) {
    const next = new Map<string, SearchState>()
    for (const state of beam) {
      const target = aspects
        .filter((aspect) => state.remaining[aspect] > 0)
        .sort((a, b) => byAspect.get(a)!.length - byAspect.get(b)!.length || a.localeCompare(b))[0]
      if (!target) {
        if (!best || state.cost < best.cost) best = state
        continue
      }
      for (const item of byAspect.get(target)!) {
        if (
          [...state.counts.keys()].some(
            (chosen) => chosen.name === item.name && key(chosen) !== key(item),
          )
        )
          continue
        const amount = item.aspects[target]
        const needed = state.remaining[target]
        const quantities = new Set([
          1,
          Math.max(1, Math.floor(needed / amount)),
          Math.ceil(needed / amount),
        ])
        for (const count of quantities) {
          const cost =
            state.cost +
            additionCost(item, count, state.remaining, !state.counts.has(item), preferences)
          if (best && cost >= best.cost) continue
          const remaining = Object.fromEntries(
            aspects.map((aspect) => [
              aspect,
              Math.max(0, state.remaining[aspect] - (item.aspects[aspect] ?? 0) * count),
            ]),
          )
          const counts = new Map(state.counts)
          counts.set(item, (counts.get(item) ?? 0) + count)
          const candidate = { remaining, counts, cost }
          if (aspects.every((aspect) => remaining[aspect] === 0)) {
            if (!best || cost < best.cost) best = candidate
            continue
          }
          const signature = `${aspects.map((aspect) => remaining[aspect]).join(',')}|${[...counts.keys()].map(key).sort().join(';')}`
          const previous = next.get(signature)
          if (!previous || candidate.cost < previous.cost) next.set(signature, candidate)
        }
      }
    }
    beam = [...next.values()]
      .sort((a, b) => priority(a) - priority(b) || a.cost - b.cost)
      .slice(0, width)
  }
  return best?.counts ?? null
}
