import {
  boardDistance,
  getBoardNeighbors,
  routeTurns,
} from '@/features/research-map/board/boardGeometry'

export type ConnectionCandidate = {
  target: string
  route: string[]
  aspects: string[]
  aspectCost: number
  newCells: number
  turns: number
  distanceToRemaining: number
}

type ConnectionAssessment = {
  route: string[]
  aspects: string[]
  target: string
  blockedCells: Set<string>
  connected: Set<string>
  remaining: Set<string>
  boardSize: number
  aspectWeights: Readonly<Record<string, number>>
}

export function assessConnection({
  route,
  aspects,
  target,
  blockedCells,
  connected,
  remaining,
  boardSize,
  aspectWeights,
}: ConnectionAssessment): ConnectionCandidate | null {
  const futureNetwork = new Set([...connected, ...route])
  const blockedAfterRoute = new Set([...blockedCells, ...route])
  let distanceToRemaining = 0

  for (const futureTarget of remaining) {
    if (futureTarget === target) continue

    const hasExit = getBoardNeighbors(futureTarget, boardSize).some(
      (neighbor) => !blockedAfterRoute.has(neighbor) || futureNetwork.has(neighbor),
    )
    if (!hasExit) return null

    let nearestDistance = Number.POSITIVE_INFINITY
    for (const cell of futureNetwork) {
      nearestDistance = Math.min(nearestDistance, boardDistance(cell, futureTarget))
    }
    distanceToRemaining += nearestDistance
  }

  let aspectCost = 0
  for (const aspect of aspects.slice(1, -1)) {
    const weight = aspectWeights[aspect]
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`Invalid aspect weight: ${aspect}`)
    }
    aspectCost += weight
  }

  return {
    target,
    route,
    aspects,
    aspectCost,
    newCells: route.length - 2,
    turns: routeTurns(route),
    distanceToRemaining,
  }
}

export function compareConnections(left: ConnectionCandidate, right: ConnectionCandidate) {
  if (Math.abs(left.aspectCost - right.aspectCost) > 1e-9) {
    return left.aspectCost - right.aspectCost
  }
  if (left.newCells !== right.newCells) return left.newCells - right.newCells
  if (left.turns !== right.turns) return left.turns - right.turns
  return left.distanceToRemaining - right.distanceToRemaining
}
