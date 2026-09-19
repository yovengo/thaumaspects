import { quantile } from './imageProcessing'

export type LatticeCell = { column: number; row: number; x: number; y: number; score: number; presenceScore: number }

export type GridDetection = {
  radius: number
  quality: number
  cells: LatticeCell[]
  outlineCells: LatticeCell[]
  outlineThreshold: number
}

const cellKey = (row: number, column: number) => `${row}:${column}`

function neighborKeys(cell: Pick<LatticeCell, 'row' | 'column'>) {
  const odd = Math.abs(cell.column % 2) === 1
  const directions = odd
    ? [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
    : [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]
  return directions.map(([rowOffset, columnOffset]) => cellKey(cell.row + rowOffset, cell.column + columnOffset))
}

function edgeAt(edges: Uint8Array, width: number, height: number, x: number, y: number) {
  const roundedX = Math.round(x)
  const roundedY = Math.round(y)
  if (roundedX < 1 || roundedY < 1 || roundedX >= width - 1 || roundedY >= height - 1) return 0
  let strongest = 0
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      strongest = Math.max(strongest, edges[(roundedY + offsetY) * width + roundedX + offsetX])
    }
  }
  return strongest / 255
}

function hexOutlineScore(edges: Uint8Array, width: number, height: number, centerX: number, centerY: number, radius: number) {
  const verticalRadius = radius * Math.sqrt(3) / 2
  const vertices = [
    [radius, 0], [radius / 2, verticalRadius], [-radius / 2, verticalRadius],
    [-radius, 0], [-radius / 2, -verticalRadius], [radius / 2, -verticalRadius],
  ]
  const sideScores: number[] = []
  for (let side = 0; side < 6; side += 1) {
    const from = vertices[side]
    const to = vertices[(side + 1) % 6]
    let sideTotal = 0
    for (let step = 0; step < 5; step += 1) {
      const progress = (step + 0.5) / 5
      sideTotal += edgeAt(
        edges,
        width,
        height,
        centerX + from[0] + (to[0] - from[0]) * progress,
        centerY + from[1] + (to[1] - from[1]) * progress,
      )
    }
    sideScores.push(sideTotal / 5)
  }
  const average = sideScores.reduce((sum, score) => sum + score, 0) / sideScores.length
  const secondWeakestSide = [...sideScores].sort((a, b) => a - b)[1]
  return average * 0.62 + secondWeakestSide * 0.38
}

function printedCellScore(edges: Uint8Array, width: number, height: number, x: number, y: number, radius: number) {
  // Adjacent cells also draw a ring around a missing position. The printed cell is
  // slightly smaller than that ring and note captures introduce a small radial warp.
  const centerX = width / 2 + (x - width / 2) * 1.06 - radius * 0.16
  const centerY = height / 2 + (y - height / 2) * 1.08 - radius * 0.15
  return hexOutlineScore(edges, width, height, centerX, centerY, radius * 0.82)
}

function makeLattice(edges: Uint8Array, width: number, height: number, radius: number, offsetX: number, offsetY: number) {
  const columnStep = radius * 1.5
  const rowStep = radius * Math.sqrt(3)
  const cells: LatticeCell[] = []
  const maxColumns = Math.ceil(width / columnStep) + 1
  const maxRows = Math.ceil(height / rowStep) + 1

  for (let column = -1; column <= maxColumns; column += 1) {
    for (let row = -1; row <= maxRows; row += 1) {
      const x = offsetX + column * columnStep
      const y = offsetY + row * rowStep + (column % 2 ? rowStep / 2 : 0)
      if (x < radius || y < radius || x >= width - radius || y >= height - radius) continue
      cells.push({
        column,
        row,
        x,
        y,
        score: hexOutlineScore(edges, width, height, x, y, radius),
        presenceScore: printedCellScore(edges, width, height, x, y, radius),
      })
    }
  }
  return cells
}

function largestConnectedComponent(cells: LatticeCell[], threshold: number) {
  const initiallyEligible = cells.filter((cell) => cell.score >= threshold)
  const initialPositions = new Map(initiallyEligible.map((cell) => [cellKey(cell.row, cell.column), cell]))
  const eligible = initiallyEligible.filter((cell) => neighborKeys(cell).filter((key) => initialPositions.has(key)).length >= 2)
  const byPosition = new Map(eligible.map((cell) => [cellKey(cell.row, cell.column), cell]))
  const visited = new Set<string>()
  let largest: LatticeCell[] = []

  for (const start of eligible) {
    const startKey = cellKey(start.row, start.column)
    if (visited.has(startKey)) continue
    const component: LatticeCell[] = []
    const queue = [start]
    visited.add(startKey)
    while (queue.length) {
      const current = queue.shift()!
      component.push(current)
      for (const neighborKey of neighborKeys(current)) {
        const neighbor = byPosition.get(neighborKey)
        if (!neighbor || visited.has(neighborKey)) continue
        visited.add(neighborKey)
        queue.push(neighbor)
      }
    }
    if (component.length > largest.length) largest = component
  }
  return largest
}

function outlineThresholds(cells: LatticeCell[]) {
  const scores = cells.map((cell) => cell.score)
  let low = quantile(scores, 0.25)
  let high = quantile(scores, 0.9)
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const lowValues = scores.filter((score) => Math.abs(score - low) <= Math.abs(score - high))
    const highValues = scores.filter((score) => Math.abs(score - low) > Math.abs(score - high))
    if (lowValues.length) low = lowValues.reduce((sum, score) => sum + score, 0) / lowValues.length
    if (highValues.length) high = highValues.reduce((sum, score) => sum + score, 0) / highValues.length
  }
  return {
    strong: Math.max(0.34, low + Math.max(0.05, (high - low) * 0.56)),
    loose: Math.max(0.3, low + Math.max(0.035, (high - low) * 0.38)),
  }
}

function evaluateLattice(cells: LatticeCell[]) {
  const thresholds = outlineThresholds(cells)
  const component = largestConnectedComponent(cells, thresholds.strong)
  const average = component.reduce((sum, cell) => sum + cell.score, 0) / Math.max(1, component.length)
  const columnSpan = component.length
    ? Math.max(...component.map((cell) => cell.column)) - Math.min(...component.map((cell) => cell.column)) + 1
    : 0
  const rowSpan = component.length
    ? Math.max(...component.map((cell) => cell.row)) - Math.min(...component.map((cell) => cell.row)) + 1
    : 0
  const oversizePenalty = columnSpan > 15 || rowSpan > 15
    ? 10
    : 0
  const density = component.length / Math.max(1, columnSpan * rowSpan)
  const quality = average + Math.min(55, component.length) * 0.013 + density * 0.18
    - (component.length < 7 ? 0.3 : 0) - oversizePenalty
  return { quality, component, thresholds }
}

function growComponent(component: LatticeCell[], cells: LatticeCell[], threshold: number) {
  const byPosition = new Map(cells.map((cell) => [cellKey(cell.row, cell.column), cell]))
  const included = new Map(component.map((cell) => [cellKey(cell.row, cell.column), cell]))
  for (let pass = 0; pass < 1; pass += 1) {
    const additions: LatticeCell[] = []
    for (const candidate of byPosition.values()) {
      const candidateKey = cellKey(candidate.row, candidate.column)
      if (included.has(candidateKey) || candidate.score < threshold) continue
      const support = neighborKeys(candidate).filter((key) => included.has(key)).length
      if (support >= 2) additions.push(candidate)
    }
    additions.forEach((cell) => included.set(cellKey(cell.row, cell.column), cell))
  }
  return [...included.values()]
}

export function recognizeGrid(edges: Uint8Array, width: number, height: number): GridDetection {
  const shortestSide = Math.min(width, height)
  const minimumRadius = Math.max(6, Math.floor(shortestSide / 20))
  const maximumRadius = Math.min(34, Math.ceil(shortestSide / 7))
  type Candidate = { radius: number; offsetX: number; offsetY: number; cells: LatticeCell[]; quality: number; component: LatticeCell[]; looseThreshold: number }
  let best: Candidate | null = null

  const consider = (radius: number, offsetX: number, offsetY: number) => {
    const cells = makeLattice(edges, width, height, radius, offsetX, offsetY)
    const evaluated = evaluateLattice(cells)
    if (!best || evaluated.quality > best.quality) {
      best = {
        radius,
        offsetX,
        offsetY,
        cells,
        quality: evaluated.quality,
        component: evaluated.component,
        looseThreshold: evaluated.thresholds.loose,
      }
    }
  }

  for (let radius = minimumRadius; radius <= maximumRadius; radius += 1) {
    const columnStep = radius * 1.5
    const rowStep = radius * Math.sqrt(3)
    const stride = Math.max(2, radius / 4)
    for (let offsetX = 0; offsetX < columnStep; offsetX += stride) {
      for (let offsetY = 0; offsetY < rowStep; offsetY += stride) {
        consider(radius, offsetX, offsetY)
      }
    }
  }

  if (!best || (best as Candidate).component.length < 7) {
    throw new Error('Not enough connected hexes were found. Paste a screenshot with the whole research note visible.')
  }
  const coarse = best as Candidate
  const refinementRange = Math.max(4, coarse.radius / 4)
  for (let radius = Math.max(minimumRadius, coarse.radius - 3); radius <= Math.min(maximumRadius, coarse.radius + 3); radius += 0.25) {
    for (let offsetX = coarse.offsetX - refinementRange; offsetX <= coarse.offsetX + refinementRange; offsetX += 1) {
      for (let offsetY = coarse.offsetY - refinementRange; offsetY <= coarse.offsetY + refinementRange; offsetY += 1) {
        consider(radius, offsetX, offsetY)
      }
    }
  }
  if (!best || (best as Candidate).component.length < 7) {
    throw new Error('The hexagonal grid could not be refined.')
  }
  const refined = best as Candidate
  const outlineCells = growComponent(refined.component, refined.cells, refined.looseThreshold)
  return {
    radius: refined.radius,
    quality: refined.quality,
    cells: refined.cells,
    outlineCells,
    outlineThreshold: refined.looseThreshold,
  }
}
