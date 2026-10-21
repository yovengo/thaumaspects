import type { Combinations } from '@/features/research-map/model/types'

type SearchStep = {
  aspect: string
  steps: number
  previous: SearchStep | null
}

function pathFromLastStep(last: SearchStep) {
  const path: string[] = []
  let current: SearchStep | null = last

  while (current) {
    path.push(current.aspect)
    current = current.previous
  }

  return path.reverse()
}

function buildAspectGraph(combinations: Combinations) {
  const neighborsByAspect: Record<string, string[]> = {}

  const connect = (first: string, second: string) => {
    if (!neighborsByAspect[first]) {
      neighborsByAspect[first] = []
    }
    if (!neighborsByAspect[second]) {
      neighborsByAspect[second] = []
    }

    neighborsByAspect[first].push(second)
    neighborsByAspect[second].push(first)
  }

  for (const [compound, [firstPart, secondPart]] of Object.entries(combinations)) {
    connect(compound, firstPart)
    connect(compound, secondPart)
  }

  return neighborsByAspect
}

export function createAspectPathFinder(combinations: Combinations, enabled: Set<string>) {
  const neighborsByAspect = buildAspectGraph(combinations)
  const allowedAspects = new Set(enabled)
  const cachedPaths = new Map<string, string[] | null>()

  return function findPath(from: string, to: string, minSpaces: number) {
    if (!allowedAspects.has(from) || !allowedAspects.has(to)) return null

    const cacheKey = JSON.stringify([from, to, minSpaces])
    const cachedPath = cachedPaths.get(cacheKey)
    if (cachedPath !== undefined) return cachedPath

    const minimumSteps = minSpaces + 1
    const maximumSteps = Math.max(minimumSteps + 1, allowedAspects.size)
    const queue: SearchStep[] = [{ aspect: from, steps: 0, previous: null }]
    const visitedStepsByAspect = new Map<string, Set<number>>([[from, new Set([0])]])
    let nextInQueue = 0

    while (nextInQueue < queue.length) {
      const current = queue[nextInQueue]
      nextInQueue += 1

      if (current.aspect === to && current.steps >= minimumSteps) {
        const path = pathFromLastStep(current)
        cachedPaths.set(cacheKey, path)
        return path
      }

      if (current.steps >= maximumSteps) continue

      const neighbors = neighborsByAspect[current.aspect]
      if (!neighbors) continue

      for (const nextAspect of neighbors) {
        if (!allowedAspects.has(nextAspect)) continue

        const nextSteps = current.steps + 1
        let visitedSteps = visitedStepsByAspect.get(nextAspect)
        if (!visitedSteps) {
          visitedSteps = new Set<number>()
          visitedStepsByAspect.set(nextAspect, visitedSteps)
        }
        if (visitedSteps.has(nextSteps)) continue
        visitedSteps.add(nextSteps)

        const nextStep: SearchStep = {
          aspect: nextAspect,
          steps: nextSteps,
          previous: current,
        }

        if (nextAspect === to && nextSteps >= minimumSteps) {
          const path = pathFromLastStep(nextStep)
          cachedPaths.set(cacheKey, path)
          return path
        }

        queue.push(nextStep)
      }
    }

    cachedPaths.set(cacheKey, null)
    return null
  }
}

export function findAspectPath(
  from: string,
  to: string,
  minSpaces: number,
  combinations: Combinations,
  enabled: Set<string>,
) {
  return createAspectPathFinder(combinations, enabled)(from, to, minSpaces)
}
