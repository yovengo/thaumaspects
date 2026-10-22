import type { Combinations } from '@/features/research-map/model/types'

type PathState = {
  aspect: string
  cost: number
  previous: PathState | null
}

function pathFromLastState(last: PathState) {
  const path: string[] = []
  let current: PathState | null = last

  while (current) {
    path.push(current.aspect)
    current = current.previous
  }

  return path.reverse()
}

function buildAspectGraph(combinations: Combinations) {
  const neighborsByAspect: Record<string, string[]> = {}

  const connect = (first: string, second: string) => {
    if (!neighborsByAspect[first]) neighborsByAspect[first] = []
    if (!neighborsByAspect[second]) neighborsByAspect[second] = []

    neighborsByAspect[first].push(second)
    neighborsByAspect[second].push(first)
  }

  for (const [compound, [firstPart, secondPart]] of Object.entries(combinations)) {
    connect(compound, firstPart)
    connect(compound, secondPart)
  }

  return neighborsByAspect
}

export function createAspectPathFinder(
  combinations: Combinations,
  enabled: Set<string>,
  aspectWeights: Readonly<Record<string, number>>,
) {
  const neighborsByAspect = buildAspectGraph(combinations)
  const allowedAspects = new Set(enabled)
  const layersBySource = new Map<string, Map<string, PathState>[]>()

  function layerAt(from: string, steps: number) {
    let layers = layersBySource.get(from)
    if (!layers) {
      layers = [new Map([[from, { aspect: from, cost: 0, previous: null }]])]
      layersBySource.set(from, layers)
    }

    while (layers.length <= steps) {
      const previousLayer = layers[layers.length - 1]
      const nextLayer = new Map<string, PathState>()

      for (const state of previousLayer.values()) {
        for (const neighbor of neighborsByAspect[state.aspect] ?? []) {
          if (!allowedAspects.has(neighbor)) continue

          const weight = aspectWeights[neighbor]
          if (!Number.isFinite(weight) || weight <= 0) {
            throw new Error(`Invalid aspect weight: ${neighbor}`)
          }

          const cost = state.cost + weight
          const previousBest = nextLayer.get(neighbor)
          if (!previousBest || cost < previousBest.cost) {
            nextLayer.set(neighbor, { aspect: neighbor, cost, previous: state })
          }
        }
      }

      layers.push(nextLayer)
    }

    return layers[steps]
  }

  function findPathWithSteps(from: string, to: string, steps: number): string[] | null {
    if (!Number.isInteger(steps) || steps < 0) throw new RangeError('Steps must be nonnegative')
    if (!allowedAspects.has(from) || !allowedAspects.has(to)) return null

    const last = layerAt(from, steps).get(to)
    return last ? pathFromLastState(last) : null
  }

  function findPath(from: string, to: string, minSpaces: number): string[] | null {
    if (!allowedAspects.has(from) || !allowedAspects.has(to)) return null

    const minimumSteps = Math.max(1, minSpaces + 1)
    const maximumSteps = Math.max(minimumSteps + 1, allowedAspects.size)

    for (let steps = minimumSteps; steps <= maximumSteps; steps += 1) {
      const path = findPathWithSteps(from, to, steps)
      if (path) return path
    }

    return null
  }

  return { findPath, findPathWithSteps }
}

export function findAspectPath(
  from: string,
  to: string,
  minSpaces: number,
  combinations: Combinations,
  enabled: Set<string>,
  aspectWeights: Readonly<Record<string, number>>,
) {
  return createAspectPathFinder(combinations, enabled, aspectWeights).findPath(from, to, minSpaces)
}
