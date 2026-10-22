import type { Mat } from '@techstark/opencv-js'
import { getBoardCells } from '@/features/research-map/board/boardGeometry'
import { cellCenter } from '@/features/research-map/recognition/geometry'
import type { Cv } from '@/features/research-map/recognition/opencv'
import type { PreparedTemplate } from '@/features/research-map/recognition/templates'
import type {
  AspectCandidate,
  GridGeometry,
  HexContour,
  RecognizedCell,
} from '@/features/research-map/recognition/types'

export function measureHexOutline(edges: Mat, x: number, y: number, stepX: number, stepY: number) {
  const width = stepX * 1.15
  const height = stepY * 0.9
  const vertices = [
    [-width / 4, -height / 2],
    [width / 4, -height / 2],
    [width / 2, 0],
    [width / 4, height / 2],
    [-width / 4, height / 2],
    [-width / 2, 0],
  ]
  let hits = 0
  const sideHits = [0, 0, 0, 0, 0, 0]
  const samplesPerEdge = 10

  for (let edge = 0; edge < vertices.length; edge += 1) {
    const start = vertices[edge]
    const end = vertices[(edge + 1) % vertices.length]
    for (let sample = 0; sample < samplesPerEdge; sample += 1) {
      const ratio = sample / samplesPerEdge
      const sampleX = Math.round(x + start[0] + (end[0] - start[0]) * ratio)
      const sampleY = Math.round(y + start[1] + (end[1] - start[1]) * ratio)
      let found = false
      for (let dy = -2; dy <= 2 && !found; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const px = sampleX + dx
          const py = sampleY + dy
          if (
            px >= 0 &&
            py >= 0 &&
            px < edges.cols &&
            py < edges.rows &&
            edges.data[py * edges.cols + px]
          ) {
            found = true
            break
          }
        }
      }
      if (found) {
        hits += 1
        sideHits[edge] += 1
      }
    }
  }

  return {
    score: hits / (vertices.length * samplesPerEdge),
    sides: sideHits.map((count) => count / samplesPerEdge),
  }
}

function foregroundRatio(
  rgb: Mat,
  x: number,
  y: number,
  radius: number,
  paperColor: [number, number, number],
) {
  let foreground = 0
  let total = 0
  for (let py = Math.round(y - radius); py <= y + radius; py += 1) {
    for (let px = Math.round(x - radius); px <= x + radius; px += 1) {
      if (px < 0 || py < 0 || px >= rgb.cols || py >= rgb.rows) continue
      if (Math.hypot(px - x, py - y) > radius) continue
      const offset = (py * rgb.cols + px) * 3
      const difference =
        Math.abs(rgb.data[offset] - paperColor[0]) +
        Math.abs(rgb.data[offset + 1] - paperColor[1]) +
        Math.abs(rgb.data[offset + 2] - paperColor[2])
      if (difference > 155) foreground += 1
      total += 1
    }
  }
  return total ? foreground / total : 0
}

export function matchAspectTemplates(
  cv: Cv,
  rgb: Mat,
  x: number,
  y: number,
  stepX: number,
  templates: PreparedTemplate[],
): AspectCandidate[] {
  const side = Math.round(stepX * 1.6)
  const left = Math.max(0, Math.min(rgb.cols - side, Math.round(x - side / 2)))
  const top = Math.max(0, Math.min(rgb.rows - side, Math.round(y - side / 2)))
  if (side < 12 || left < 0 || top < 0 || side > rgb.cols || side > rgb.rows) return []

  const region = rgb.roi(new cv.Rect(left, top, side, side))
  const scores = new Map<string, number>()
  try {
    for (const template of templates) {
      if (template.image.cols > region.cols || template.image.rows > region.rows) continue
      const result = new cv.Mat()
      try {
        cv.matchTemplate(region, template.image, result, cv.TM_CCOEFF_NORMED)
        const score = (cv.minMaxLoc as unknown as (source: Mat) => { maxVal: number })(
          result,
        ).maxVal
        if (Number.isFinite(score) && score > (scores.get(template.aspect) ?? -1)) {
          scores.set(template.aspect, score)
        }
      } finally {
        result.delete()
      }
    }
  } finally {
    region.delete()
  }
  return [...scores]
    .map(([aspect, score]) => ({ aspect, score }))
    .sort((first, second) => second.score - first.score)
    .slice(0, 3)
}

export function classifyCells(
  cv: Cv,
  rgb: Mat,
  edges: Mat,
  geometry: GridGeometry,
  contours: HexContour[],
  templates: PreparedTemplate[],
  paperColor: [number, number, number],
): RecognizedCell[] {
  return getBoardCells(geometry.radius * 2 + 1).map(({ row, column }) => {
    const center = cellCenter(geometry, row, column)
    const outline = measureHexOutline(edges, center.x, center.y, geometry.stepX, geometry.stepY)
    const ringScore = outline.score
    const hasContour = contours.some(
      (contour) =>
        Math.hypot(contour.x - center.x, contour.y - center.y) < geometry.stepX * 0.22 &&
        contour.width > geometry.stepX * 0.75,
    )
    const foreground = foregroundRatio(rgb, center.x, center.y, geometry.stepX * 0.54, paperColor)
    const candidates =
      foreground > 0.08
        ? matchAspectTemplates(cv, rgb, center.x, center.y, geometry.stepX, templates)
        : []
    const best = candidates[0]
    const second = candidates[1]
    const aspectScore = best?.score ?? 0
    const margin = aspectScore - (second?.score ?? 0)

    if (aspectScore >= 0.58 && margin >= 0.05) {
      return {
        row,
        column,
        center,
        type: 'aspect',
        aspect: best.aspect,
        confidence: Math.min(1, aspectScore),
        ringScore,
        aspectScore,
        candidates,
      }
    }

    let type: RecognizedCell['type'] = 'unknown'
    if (aspectScore < 0.56 && foreground < 0.14) {
      const largeScreenshot = geometry.stepX > 60
      const obstacleThreshold = largeScreenshot ? 0.2 : 0.38
      const emptyThreshold = largeScreenshot ? 0.24 : 0.43
      const oppositeSupport = Math.min(
        outline.sides[0] + outline.sides[3],
        outline.sides[1] + outline.sides[4],
        outline.sides[2] + outline.sides[5],
      )
      const incompleteOutline = !largeScreenshot && ringScore < 0.65 && oppositeSupport <= 0.55
      if (!hasContour && (ringScore < obstacleThreshold || incompleteOutline)) type = 'obstacle'
      else if (hasContour || ringScore >= emptyThreshold) type = 'empty'
    }
    return {
      row,
      column,
      center,
      type,
      confidence: type === 'obstacle' ? 1 - ringScore : type === 'empty' ? ringScore : 0,
      ringScore,
      aspectScore,
      candidates,
    }
  })
}
