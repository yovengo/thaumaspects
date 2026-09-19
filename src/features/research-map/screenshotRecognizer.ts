import { cellId, getBoardCells, isBoardCell, maximumBoardSize, minimumBoardSize } from './boardGeometry'
import { loadCellModel, recognizeCellAt } from './recognition/cellModel'
import { recognizeGrid } from './recognition/gridRecognition'
import { canvasFor, clamp, findParchmentBounds, getEdgeMap, loadBitmap } from './recognition/imageProcessing'
import { loadAspectTemplates, recognizeTemplateAt } from './recognition/templateMatcher'

type ActiveCell = { row: number; column: number; x: number; y: number; score: number; presenceScore: number }

function trimSparseColumnEdges(cells: ActiveCell[], aspects: Map<string, unknown>) {
  let remaining = cells
  let changed = true
  while (changed && remaining.length) {
    changed = false
    const columns = remaining.map((cell) => cell.column)
    const minimum = Math.min(...columns)
    const maximum = Math.max(...columns)
    for (const [edge, inner] of [[minimum, minimum + 1], [maximum, maximum - 1]]) {
      const edgeCells = remaining.filter((cell) => cell.column === edge)
      const innerCount = remaining.filter((cell) => cell.column === inner).length
      const containsAspect = edgeCells.some((cell) => aspects.has(`${cell.row}:${cell.column}`))
      if (edgeCells.length <= 1 && innerCount >= 3 && !containsAspect) {
        remaining = remaining.filter((cell) => cell.column !== edge)
        changed = true
        break
      }
    }
  }
  return remaining
}

function findPresenceThreshold(cells: ActiveCell[]) {
  // Missing cells form a separate low cluster when the smaller, printed outline
  // is sampled. If there is no convincing separation, prefer no obstacles.
  const values = cells.map((cell) => cell.presenceScore).sort((a, b) => a - b)
  let bestGap = 0
  let threshold = 0
  for (let index = 0; index < values.length - 1; index += 1) {
    const lower = values[index]
    const upper = values[index + 1]
    const gap = upper - lower
    if (lower > 0.3 || upper > 0.4 || gap <= bestGap) continue
    bestGap = gap
    threshold = (lower + upper) / 2
  }
  return bestGap >= 0.032 ? threshold : 0
}

export type RecognitionResult = {
  boardSize: number
  board: Record<string, string>
  obstacles: Set<string>
  confidence: number
  gridConfidence: number
  aspectConfidence: number
  detectedCells: number
  diagnostics: string[]
}

export async function recognizeResearchScreenshot(file: File | Blob, aspects: string[]): Promise<RecognitionResult> {
  const bitmap = await loadBitmap(file)
  const longestSide = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(1, 1000 / longestSide)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const { canvas, context } = canvasFor(width, height)
  context.imageSmoothingEnabled = false
  context.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  const image = context.getImageData(0, 0, width, height)
  const bounds = findParchmentBounds(image)
  const edges = getEdgeMap(image, bounds)
  const grid = recognizeGrid(edges, bounds.width, bounds.height)
  const [cellModel, templates] = await Promise.all([loadCellModel(), loadAspectTemplates(aspects)])
  const allowedAspects = new Set(aspects)

  const shapeCells = trimSparseColumnEdges(grid.outlineCells, new Map())
  const minimumColumn = Math.min(...shapeCells.map((cell) => cell.column))
  const maximumColumn = Math.max(...shapeCells.map((cell) => cell.column))
  const startsOnOddColumn = Math.abs(minimumColumn % 2) === 1
  const normalizedRow = (row: number, column: number) => row - (startsOnOddColumn ? Math.abs((column - minimumColumn) % 2) : 0)
  const adjustedRows = shapeCells.map((cell) => normalizedRow(cell.row, cell.column))
  const minimumRow = Math.min(...adjustedRows)
  const maximumRow = Math.max(...adjustedRows)
  const detectedRows = maximumRow - minimumRow + 1
  const detectedColumns = maximumColumn - minimumColumn + 1
  const detectedDiameter = Math.max(detectedRows, detectedColumns)
  const oddDiameter = detectedDiameter % 2 === 0 ? detectedDiameter + 1 : detectedDiameter
  const boardSize = clamp(oddDiameter, minimumBoardSize, maximumBoardSize)
  const rowPadding = Math.floor((boardSize - detectedRows) / 2)
  const columnPadding = Math.floor((boardSize - detectedColumns) / 2)
  const normalizedPosition = (cell: Pick<ActiveCell, 'row' | 'column'>) => ({
    row: normalizedRow(cell.row, cell.column) - minimumRow + rowPadding,
    column: cell.column - minimumColumn + columnPadding,
  })
  const activeCells = grid.cells.filter((cell) => {
    const position = normalizedPosition(cell)
    return isBoardCell(position.row, position.column, boardSize)
  })

  const recognizedAspects = new Map<string, { aspect: string; score: number }>()
  const aspectScores: number[] = []
  const aspectCandidates: { row: number; column: number; x: number; y: number; aspect: string; score: number; templateScore: number; margin: number; agrees: boolean; matchX: number; matchY: number }[] = []
  const neuralPresence = new Map<string, number>()

  activeCells.forEach((fitted) => {
    const neural = recognizeCellAt(
      canvas,
      bounds.x + fitted.x,
      bounds.y + fitted.y,
      grid.radius,
      cellModel,
      allowedAspects,
    )
    const template = recognizeTemplateAt(
      canvas,
      bounds.x + fitted.x,
      bounds.y + fitted.y,
      grid.radius,
      templates,
    )
    const agrees = neural.aspect === template.aspect
    neuralPresence.set(`${fitted.row}:${fitted.column}`, neural.presenceConfidence)
    aspectCandidates.push({
      row: fitted.row,
      column: fitted.column,
      x: bounds.x + fitted.x,
      y: bounds.y + fitted.y,
      aspect: template.aspect,
      score: clamp(template.score + (agrees ? neural.aspectConfidence * 0.1 : 0), 0, 1),
      templateScore: template.score,
      margin: template.margin,
      agrees,
      matchX: template.matchX,
      matchY: template.matchY,
    })
  })
  const acceptedCandidates = aspectCandidates
    .filter((candidate) => candidate.aspect
      && ((candidate.templateScore >= 0.68 && candidate.margin >= 0.025)
        || (candidate.agrees && candidate.templateScore >= 0.56 && candidate.margin >= 0.018))
      && candidate.matchX >= bounds.x + bounds.width * 0.12
      && candidate.matchX <= bounds.x + bounds.width * 0.88
      && candidate.matchY >= bounds.y + bounds.height * 0.08
      && candidate.matchY <= bounds.y + bounds.height * 0.9)
    .sort((a, b) => b.score - a.score)
  const distinctCandidates: typeof acceptedCandidates = []
  acceptedCandidates.forEach((candidate) => {
    if (distinctCandidates.some((accepted) => Math.hypot(
      accepted.matchX - candidate.matchX,
      accepted.matchY - candidate.matchY,
    ) < grid.radius * 1.3)) return
    distinctCandidates.push(candidate)
    recognizedAspects.set(`${candidate.row}:${candidate.column}`, { aspect: candidate.aspect, score: candidate.score })
    aspectScores.push(candidate.score)
  })
  const board: Record<string, string> = {}
  const obstacles = new Set<string>()
  const detectedCells = new Set<string>()
  const presenceThreshold = findPresenceThreshold(activeCells)
  const neuralMissing = new Set(activeCells
    .filter((cell) => (neuralPresence.get(`${cell.row}:${cell.column}`) ?? 1) < 0.5)
    .map((cell) => `${cell.row}:${cell.column}`))
  const trustNeuralPresence = neuralMissing.size > 0
    && neuralMissing.size <= Math.max(6, Math.floor(getBoardCells(boardSize).length * 0.22))

  activeCells.forEach((cell) => {
    const { row, column } = normalizedPosition(cell)
    if (!isBoardCell(row, column, boardSize)) return
    const id = cellId(row, column)
    const aspect = recognizedAspects.get(`${cell.row}:${cell.column}`)
    const edgePresent = presenceThreshold === 0 || cell.presenceScore >= presenceThreshold
    const modelPresent = !trustNeuralPresence || !neuralMissing.has(`${cell.row}:${cell.column}`)
    if ((edgePresent && modelPresent) || aspect) detectedCells.add(id)
    if (aspect) board[id] = aspect.aspect
  })
  const boardCells = getBoardCells(boardSize)
  boardCells.forEach(({ row, column }) => {
    const id = cellId(row, column)
    if (!detectedCells.has(id)) obstacles.add(id)
  })

  const gridCoverage = detectedCells.size / boardCells.length
  const gridConfidence = clamp((grid.quality - 0.22) * 1.6, 0.05, 0.99) * 0.65
    + clamp(gridCoverage * 1.25, 0, 1) * 0.35
  const aspectConfidence = aspectScores.length
    ? clamp(aspectScores.reduce((sum, score) => sum + score, 0) / aspectScores.length, 0, 1)
    : 0
  const confidence = gridConfidence * 0.7 + (aspectScores.length ? aspectConfidence : 0.35) * 0.3
  const diagnostics: string[] = []
  if (bounds.width === width && bounds.height === height) diagnostics.push('The parchment boundary was uncertain; the whole image was analyzed.')
  if (gridConfidence < 0.55) diagnostics.push('Grid confidence is low. Use a screenshot with the entire parchment visible.')
  if (!aspectScores.length) diagnostics.push('No aspect icons were recognized. You can still import the detected grid and place aspects manually.')
  if (obstacles.size > boardCells.length * 0.55) diagnostics.push('Many cells look blocked; check the imported map before auto-connect.')

  return {
    boardSize,
    board,
    obstacles,
    confidence,
    gridConfidence,
    aspectConfidence,
    detectedCells: detectedCells.size,
    diagnostics,
  }
}
