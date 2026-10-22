import type { Combinations } from '@/features/research-map/model/types'

export function calculateAspectCosts(
  baseAspects: readonly string[],
  combinations: Combinations,
): Record<string, number> {
  const base = new Set(baseAspects)
  const costs = new Map<string, number>()
  const visiting = new Set<string>()

  function costOf(aspect: string): number {
    const cached = costs.get(aspect)
    if (cached !== undefined) return cached
    if (visiting.has(aspect)) throw new Error(`Circular aspect recipe: ${aspect}`)

    if (base.has(aspect)) {
      costs.set(aspect, 1)
      return 1
    }

    const parts = combinations[aspect]
    if (!parts) throw new Error(`Missing aspect recipe: ${aspect}`)

    visiting.add(aspect)
    try {
      const cost = 1 + costOf(parts[0]) + costOf(parts[1])
      costs.set(aspect, cost)
      return cost
    } finally {
      visiting.delete(aspect)
    }
  }

  for (const aspect of baseAspects) costOf(aspect)
  for (const aspect of Object.keys(combinations)) costOf(aspect)

  return Object.fromEntries(costs)
}

export function calculateAspectWeights(
  costs: Readonly<Record<string, number>>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(costs).map(([aspect, cost]) => [aspect, 1 + Math.log2(cost)]),
  )
}
