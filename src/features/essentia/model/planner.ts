export type ItemIconData =
  | { kind: 'atlas'; id: number; quality: 'exact' | 'ambiguous' | 'related' | 'generic' }
  | { kind: 'rendered'; file: string; quality: 'exact' | 'ambiguous' }
export type ItemAspect = {
  name: string
  aspects: Record<string, number>
  icon?: ItemIconData
  registryId?: string
  aspectVersion?: string
  acquisition?: Record<string, [number, number]>
}
export type Requirement = Record<string, number>
export type PlanLine = { item: ItemAspect; count: number }
export type Plan = {
  id: string
  title: string
  lines: PlanLine[]
  produced: Requirement
  remaining: Requirement
  itemCount: number
  extra: number
}
export type PlannerPreferences = {
  preferred?: ReadonlySet<string>
  excluded?: ReadonlySet<string>
  stage?: string
}

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

function simplePlanCounts(
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

function makePlan(
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

export function buildPlans(
  items: ItemAspect[],
  required: Requirement,
  preferences: PlannerPreferences = {},
  favoritePlan?: Plan,
): Plan[] {
  if (!Object.values(required).some((amount) => amount > 0)) return []
  const aspects = Object.keys(required).filter((aspect) => required[aspect] > 0)
  const seed = favoritePlan && new Map(favoritePlan.lines.map(({ item, count }) => [item, count]))
  const simple = makePlan(items, required, 'Practical items', 'simple', preferences, seed)
  const clean = makePlan(items, required, 'Less excess essentia', 'clean', preferences)
  const totalNeeded = Object.values(required).reduce((sum, amount) => sum + Math.max(0, amount), 0)
  const fewest = makePlan(items, required, 'Fewest items', 'fewest', preferences)
  const planCost = (plan: Plan) =>
    plan.lines.reduce((sum, line) => sum + itemEffort(line.item, preferences) * line.count, 0) +
    plan.extra * 0.2 +
    plan.lines.length * 4
  const simpleCost = simple ? planCost(simple) : Infinity
  const variants = [
    simple,
    fewest && fewest.extra <= Math.max(24, totalNeeded * 1.5) ? fewest : null,
    clean && (!simple || (clean.extra < simple.extra && planCost(clean) <= simpleCost * 2))
      ? clean
      : null,
    favoritePlan ? { ...favoritePlan, title: 'From favorites' } : null,
  ]
  if (simple) {
    const replacementPlans: Plan[] = []
    const maximumExtra = Math.max(24, simple.extra, totalNeeded)
    for (const line of simple.lines) {
      const otherLines = simple.lines.filter((entry) => entry !== line)
      const otherPlan = planFromLines(otherLines, required)
      const deficit = aspects.filter((aspect) => (otherPlan.remaining[aspect] ?? 0) > 0)
      if (deficit.length === 0) continue
      const otherCost = otherLines.reduce(
        (sum, entry) => sum + itemEffort(entry.item, preferences) * entry.count,
        0,
      )
      const bestReplacements: { item: ItemAspect; count: number; cost: number; id: string }[] = []
      for (const item of items) {
        if (preferences.excluded?.size && preferences.excluded.has(key(item))) continue
        const effort = itemEffort(item, preferences)
        if (
          effort >= 1000 ||
          item.name === line.item.name ||
          !deficit.every((aspect) => (item.aspects[aspect] ?? 0) > 0) ||
          !aspects.every(
            (aspect) => (item.aspects[aspect] ?? 0) <= 0 || (line.item.aspects[aspect] ?? 0) > 0,
          )
        )
          continue
        const count = Math.max(
          ...deficit.map((aspect) => Math.ceil(otherPlan.remaining[aspect] / item.aspects[aspect])),
        )
        let extra = 0
        const produced = { ...otherPlan.produced }
        for (const [aspect, amount] of Object.entries(item.aspects))
          produced[aspect] = (produced[aspect] ?? 0) + amount * count
        for (const [aspect, amount] of Object.entries(produced))
          extra += Math.max(0, amount - (required[aspect] ?? 0))
        if (extra > maximumExtra) continue
        const existing = otherLines.find((entry) => key(entry.item) === key(item))
        const id = [
          ...otherLines
            .filter((entry) => entry !== existing)
            .map(({ item: source, count: amount }) => `${key(source)}×${amount}`),
          `${key(item)}×${count + (existing?.count ?? 0)}`,
        ]
          .sort()
          .join(';')
        const cost =
          otherCost + effort * count + extra * 0.2 + (otherLines.length + (existing ? 0 : 1)) * 4
        const candidate = { item, count, cost, id }
        const position = bestReplacements.findIndex(
          (entry) => cost < entry.cost || (cost === entry.cost && id.localeCompare(entry.id) < 0),
        )
        if (position === -1) {
          if (bestReplacements.length < 3) bestReplacements.push(candidate)
        } else bestReplacements.splice(position, 0, candidate)
        if (bestReplacements.length > 3) bestReplacements.pop()
      }
      for (const replacement of bestReplacements) {
        const combined = new Map<string, PlanLine>()
        for (const entry of [...otherLines, { item: replacement.item, count: replacement.count }]) {
          const id = key(entry.item)
          const previous = combined.get(id)
          combined.set(id, { item: entry.item, count: (previous?.count ?? 0) + entry.count })
        }
        const lines = [...combined.values()].sort(
          (a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name),
        )
        const plan = planFromLines(lines, required, `Instead of ${line.item.name}`)
        plan.id = replacement.id
        replacementPlans.push(plan)
      }
    }
    variants.push(...replacementPlans.slice(0, 4))
  }
  const seen = new Set<string>()
  return variants.filter((plan): plan is Plan => {
    if (!plan || seen.has(plan.id)) return false
    seen.add(plan.id)
    return true
  })
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
