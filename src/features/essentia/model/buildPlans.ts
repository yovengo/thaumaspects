import { itemEffort, key } from './itemRanking.ts'
import { makePlan, planFromLines } from './planConstruction.ts'
import type { ItemAspect, Plan, PlanLine, PlannerPreferences, Requirement } from './plannerTypes.ts'

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
