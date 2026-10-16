import practicalNames from '../data/practicalItems.json'

export type ItemIconData =
  | { kind: 'atlas'; id: number; quality: 'exact' | 'ambiguous' | 'related' | 'generic' }
  | { kind: 'rendered'; file: string; quality: 'exact' | 'ambiguous' }
export type ItemAspect = { name: string; aspects: Record<string, number>; icon?: ItemIconData }
export type Requirement = Record<string, number>
export type PlanLine = { item: ItemAspect; count: number }
export type Plan = { id: string; title: string; lines: PlanLine[]; produced: Requirement; remaining: Requirement; itemCount: number; extra: number }

const practical = new Set<string>(practicalNames)
const common = new Set(['Coal', 'Charcoal', 'Cobblestone', 'Redstone', 'Torch', 'Stick', 'Iron Ingot', 'Glass', 'Sugar', 'Bone', 'Rotten Flesh', 'Feather', 'Paper', 'Book', 'Sand', 'Dirt', 'Clay', 'Netherrack'])
const namePenalty = /\b(?:Creative|Infused|Catalyst|Singularity|Infinity|Ultimate|Quantum|Fusion|Neutronium|Compressed|Colored|Decorative)\b/i

export function itemSimplicity(item: ItemAspect) {
  if (item.name === 'Coal') return -0.05
  if (common.has(item.name)) return 0
  if (item.name === 'Coal Coke') return 1
  if (item.name === 'Block of Coal') return 1.45
  if (item.name === 'Block of Charcoal') return 1.5
  return (practical.has(item.name) ? 0.65 : 3) + (namePenalty.test(item.name) ? 5 : 0) + (item.name.startsWith('Block of ') ? 1.5 : 0)
}

function key(item: ItemAspect) {
  return `${item.name}|${Object.entries(item.aspects).sort(([a], [b]) => a.localeCompare(b)).map(([aspect, amount]) => `${aspect}:${amount}`).join(',')}`
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

function makePlan(items: ItemAspect[], required: Requirement, title: string, strategy: 'simple' | 'fewest' | 'clean'): Plan | null {
  const aspects = Object.keys(required).filter((aspect) => required[aspect] > 0)
  const profiles = new Map<string, ItemAspect>()
  items.forEach((item) => {
    if (!aspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0)) return
    const profile = key({ ...item, name: '' })
    const previous = profiles.get(profile)
    if (!previous || itemSimplicity(item) < itemSimplicity(previous) || (itemSimplicity(item) === itemSimplicity(previous) && item.name.localeCompare(previous.name) < 0)) profiles.set(profile, item)
  })
  const candidates = [...profiles.values()]
  if (aspects.some((aspect) => !candidates.some((item) => (item.aspects[aspect] ?? 0) > 0))) return null

  // Prefer the community's practical sources when they cover every requested aspect.
  const practicalOnly = aspects.every((aspect) => candidates.some((item) => itemSimplicity(item) < 2 && (item.aspects[aspect] ?? 0) > 0))
  const pool = practicalOnly && strategy !== 'clean' ? candidates.filter((item) => itemSimplicity(item) < 2) : candidates
  const remaining = { ...required }
  let counts = new Map<ItemAspect, number>()
  const totalNeeded = Object.values(required).reduce((sum, value) => sum + value, 0)

  for (let step = 0; step < Math.min(2048, totalNeeded + 8); step += 1) {
    if (aspects.every((aspect) => remaining[aspect] <= 0)) break
    let best: ItemAspect | null = null
    let bestScore = -Infinity

    for (const item of pool) {
      const gain = aspects.reduce((sum, aspect) => sum + Math.min(remaining[aspect], item.aspects[aspect] ?? 0), 0)
      if (gain <= 0) continue
      const unwanted = Object.entries(item.aspects).reduce((sum, [aspect, amount]) => sum + Math.max(0, amount - (remaining[aspect] ?? 0)), 0)
      const complexity = itemSimplicity(item)
      const effectiveGain = strategy === 'simple' ? Math.min(gain, 8) : gain
      const cost = strategy === 'simple'
        ? 1 + complexity * 2.2 + unwanted * 0.45
        : strategy === 'clean'
          ? 1 + complexity * 0.35 + unwanted * 2.5
          : 1 + complexity * 0.25 + unwanted * 0.12
      const score = effectiveGain / cost
      if (score > bestScore || (score === bestScore && best && item.name.localeCompare(best.name) < 0)) {
        best = item
        bestScore = score
      }
    }
    if (!best) return null
    counts.set(best, (counts.get(best) ?? 0) + 1)
    aspects.forEach((aspect) => { remaining[aspect] -= best.aspects[aspect] ?? 0 })
  }
  if (aspects.some((aspect) => remaining[aspect] > 0)) return null

  if (strategy === 'fewest') {
    const currentCount = [...counts.values()].reduce((sum, count) => sum + count, 0)
    let bestSingle: { item: ItemAspect; count: number; extra: number } | null = null
    for (const item of pool) {
      if (!aspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)) continue
      const count = Math.max(...aspects.map((aspect) => Math.ceil(required[aspect] / item.aspects[aspect])))
      if (count >= currentCount) continue
      const extra = Object.entries(item.aspects).reduce((sum, [aspect, amount]) => sum + Math.max(0, amount * count - (required[aspect] ?? 0)), 0)
      if (!bestSingle || count < bestSingle.count || (count === bestSingle.count && extra < bestSingle.extra)) bestSingle = { item, count, extra }
    }
    if (bestSingle) counts = new Map([[bestSingle.item, bestSingle.count]])
  }

  const lines = [...counts].map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name))
  const produced: Requirement = {}
  lines.forEach(({ item, count }) => Object.entries(item.aspects).forEach(([aspect, amount]) => {
    produced[aspect] = (produced[aspect] ?? 0) + amount * count
  }))
  return {
    id: lines.map(({ item, count }) => `${key(item)}×${count}`).sort().join(';'),
    title,
    lines,
    produced,
    remaining: Object.fromEntries(aspects.map((aspect) => [aspect, Math.max(0, required[aspect] - (produced[aspect] ?? 0))])),
    itemCount: lines.reduce((sum, line) => sum + line.count, 0),
    extra: Object.entries(produced).reduce((sum, [aspect, amount]) => sum + Math.max(0, amount - (required[aspect] ?? 0)), 0),
  }
}

export function buildPlans(items: ItemAspect[], required: Requirement): Plan[] {
  if (!Object.values(required).some((amount) => amount > 0)) return []
  const aspects = Object.keys(required).filter((aspect) => required[aspect] > 0)
  const variants = [
    makePlan(items, required, 'Простые предметы', 'simple'),
    makePlan(items, required, 'Меньше предметов', 'fewest'),
    makePlan(items, required, 'Меньше лишней эссенции', 'clean'),
  ]
  const simpleSources = items.filter((item) => aspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0) && Object.keys(item.aspects).every((aspect) => aspects.includes(aspect)))
    .sort((a, b) => itemSimplicity(a) - itemSimplicity(b) || a.name.localeCompare(b.name)).slice(0, 6)
  simpleSources.forEach((item) => {
    const count = Math.max(...aspects.map((aspect) => Math.ceil(required[aspect] / item.aspects[aspect])))
    const produced = Object.fromEntries(Object.entries(item.aspects).map(([aspect, amount]) => [aspect, amount * count]))
    variants.push({
      id: `${key(item)}×${count}`,
      title: item.name,
      lines: [{ item, count }],
      produced,
      remaining: Object.fromEntries(aspects.map((aspect) => [aspect, Math.max(0, required[aspect] - (produced[aspect] ?? 0))])),
      itemCount: count,
      extra: Object.entries(produced).reduce((sum, [aspect, amount]) => sum + Math.max(0, amount - (required[aspect] ?? 0)), 0),
    })
  })
  const seen = new Set<string>()
  return variants.filter((plan): plan is Plan => {
    if (!plan || seen.has(plan.id)) return false
    seen.add(plan.id)
    return true
  })
}

export function findAnalogues(items: ItemAspect[], target: ItemAspect, limit = 4) {
  const profile = key({ ...target, name: '' }).split('|')[1]
  return items.filter((item) => item.name !== target.name && key({ ...item, name: '' }).split('|')[1] === profile)
    .sort((a, b) => itemSimplicity(a) - itemSimplicity(b) || a.name.localeCompare(b.name)).slice(0, limit)
}

export function planFromLines(lines: PlanLine[], required: Requirement, title = 'Мой набор'): Plan {
  const produced: Requirement = {}
  lines.forEach(({ item, count }) => Object.entries(item.aspects).forEach(([aspect, amount]) => {
    produced[aspect] = (produced[aspect] ?? 0) + amount * count
  }))
  return {
    id: 'custom', title, lines, produced,
    remaining: Object.fromEntries(Object.entries(required).map(([aspect, amount]) => [aspect, Math.max(0, amount - (produced[aspect] ?? 0))])),
    itemCount: lines.reduce((sum, line) => sum + line.count, 0),
    extra: Object.entries(produced).reduce((sum, [aspect, amount]) => sum + Math.max(0, amount - (required[aspect] ?? 0)), 0),
  }
}
