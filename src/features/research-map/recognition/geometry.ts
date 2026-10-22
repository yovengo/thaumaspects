import { getBoardCells } from '@/features/research-map/board/boardGeometry'
import type {
  GridGeometry,
  HexContour,
  Point,
  Rectangle,
} from '@/features/research-map/recognition/types'

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

export function cellCenter(geometry: GridGeometry, row: number, column: number): Point {
  const { radius, center, stepX, stepY } = geometry
  return {
    x: center.x + (column - radius) * stepX,
    y: center.y + (row - radius + ((column % 2) - (radius % 2)) / 2) * stepY,
  }
}

function contourOffsets(geometry: GridGeometry, contours: HexContour[]) {
  const cells = getBoardCells(geometry.radius * 2 + 1)
  const matched = new Map<string, { distance: number; offset: Point }>()
  for (const contour of contours) {
    let nearest: { row: number; column: number; center: Point } | null = null
    let distance = Number.POSITIVE_INFINITY
    for (const cell of cells) {
      const expected = cellCenter(geometry, cell.row, cell.column)
      const nextDistance = Math.hypot(contour.x - expected.x, contour.y - expected.y)
      if (nextDistance < distance) {
        distance = nextDistance
        nearest = { row: cell.row, column: cell.column, center: expected }
      }
    }
    if (nearest && distance < geometry.stepX * 0.3) {
      const key = `${nearest.row}-${nearest.column}`
      if (distance < (matched.get(key)?.distance ?? Number.POSITIVE_INFINITY)) {
        matched.set(key, {
          distance,
          offset: { x: contour.x - nearest.center.x, y: contour.y - nearest.center.y },
        })
      }
    }
  }
  return [...matched.values()].map((match) => match.offset)
}

export function detectGridGeometry(
  paper: Rectangle,
  contours: HexContour[],
  radiusOverride?: number,
): GridGeometry {
  if (contours.length < 8) {
    throw new Error('The research grid could not be found. Try a clearer screenshot.')
  }

  const widths = contours
    .filter(
      (contour) =>
        contour.x > paper.x + paper.width * 0.15 && contour.x < paper.x + paper.width * 0.85,
    )
    .map((contour) => contour.width)
    .sort((a, b) => a - b)
  if (widths.length < 6) throw new Error('Too few hexagons were detected.')

  const stepX = widths[Math.floor(widths.length * 0.84)] * 0.86
  const stepY = stepX * 1.155
  const paperEstimate = (paper.width / stepX - 5) / 2
  const paperCenterX = paper.x + paper.width / 2
  const paperCenterY = paper.y + paper.height / 2
  const aligned = contours.flatMap((contour) => {
    if (contour.width < stepX * 0.8 || contour.width > stepX * 1.5) return []
    const column = Math.round((contour.x - paperCenterX) / stepX)
    const horizontalError = Math.abs(contour.x - paperCenterX - column * stepX) / stepX
    const verticalPosition = (contour.y - paperCenterY) / stepY
    const verticalFraction = Math.abs(verticalPosition - Math.round(verticalPosition))
    const verticalError = Math.abs(verticalFraction - (Math.abs(column) % 2) * 0.5)
    return horizontalError < 0.3 && verticalError < 0.3
      ? [{ column, vertical: verticalPosition }]
      : []
  })
  const verticalRadius = aligned.length
    ? Math.round(
        (Math.max(...aligned.map((match) => match.vertical)) -
          Math.min(...aligned.map((match) => match.vertical))) /
          2,
      )
    : 0
  let horizontalRadius = Math.max(0, ...aligned.map((match) => Math.abs(match.column)))
  while (horizontalRadius > verticalRadius) {
    const support = new Set(
      aligned
        .filter((match) => Math.abs(match.column) === horizontalRadius)
        .map((match) => `${match.column}:${Math.round(match.vertical * 2)}`),
    ).size
    if (support >= 2) break
    horizontalRadius -= 1
  }
  const visibleRadius = Math.max(horizontalRadius, verticalRadius)
  const estimatedRadius = visibleRadius >= 2 ? visibleRadius : paperEstimate
  const radius = radiusOverride ?? Math.max(2, Math.min(7, Math.round(estimatedRadius)))
  if (!Number.isInteger(radius) || radius < 2 || radius > 7) {
    throw new Error('Map radius must be between 2 and 7.')
  }

  const geometry: GridGeometry = {
    radius,
    center: { x: paperCenterX, y: paperCenterY },
    stepX,
    stepY,
    paper,
    confidence: 0,
    radiusConfidence: Math.max(
      0,
      1 - Math.abs(estimatedRadius - radius) - Math.max(0, paperEstimate - visibleRadius) * 0.4,
    ),
  }

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const offsets = contourOffsets(geometry, contours)
    if (offsets.length < 5) break
    geometry.center = {
      x: geometry.center.x + median(offsets.map((offset) => offset.x)),
      y: geometry.center.y + median(offsets.map((offset) => offset.y)),
    }
  }

  const matches = contourOffsets(geometry, contours).length
  const needed = Math.max(6, getBoardCells(radius * 2 + 1).length * 0.2)
  geometry.confidence = Math.min(1, matches / needed) * geometry.radiusConfidence
  return geometry
}
