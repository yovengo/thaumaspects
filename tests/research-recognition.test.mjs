import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const sourceDirectory = new URL('../src/', import.meta.url)
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const path = specifier.slice(2)
      return nextResolve(
        new URL(path.endsWith('.js') ? path : `${path}.ts`, sourceDirectory).href,
        context,
      )
    }
    return nextResolve(specifier, context)
  },
})

const { getCatalog, aspectIconUrl } = await import('../src/features/research-map/model/catalog.ts')
const { getBoardCells } = await import('../src/features/research-map/board/boardGeometry.ts')
const { cellCenter, detectGridGeometry } = await import(
  '../src/features/research-map/recognition/geometry.ts'
)
const { recognizeResearchScreenshot } = await import(
  '../src/features/research-map/recognition/recognizeScreenshot.ts'
)
const { recognizedMapToBoardInput } = await import(
  '../src/features/research-map/recognition/toBoardInput.ts'
)
const catalog = getCatalog()

async function rasterFromFile(path) {
  return rasterFromBuffer(fileURLToPath(path))
}

async function rasterFromBuffer(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) }
}

const templates = []
for (const aspect of catalog.aspects) {
  const path = new URL(`../public${aspectIconUrl(aspect)}`, import.meta.url)
  try {
    await access(path)
    templates.push({ aspect, image: await rasterFromFile(path) })
  } catch {
    // Some catalog entries intentionally have no icon asset.
  }
}

const fixturePaths = ['map-a.png', 'map-b.png', 'map-c.png', 'map-d.png', 'map-e.jpg'].map(
  (name) => new URL(`./fixtures/research-screenshots/${name}`, import.meta.url),
)
const screenshots = await Promise.all(fixturePaths.map(rasterFromFile))
const results = []
for (const screenshot of screenshots) {
  results.push(await recognizeResearchScreenshot(screenshot, templates))
}

function cellAt(result, row, column) {
  return result.cells.find((cell) => cell.row === row && cell.column === column)
}

test('finds the GTNH grid at multiple radii and GUI scales', () => {
  for (const result of results.slice(0, 3)) {
    assert.equal(result.geometry.radius, 3)
    assert.ok(result.geometry.confidence > 0.7)
  }
  assert.equal(results[3].geometry.radius, 4)
  assert.ok(results[3].geometry.confidence > 0.7)
  assert.ok(Math.abs(results[0].geometry.stepX - 40) < 2)
  assert.ok(Math.abs(results[2].geometry.stepX - 27) < 2)
})

test('recognizes original aspects from the supplied screenshots', () => {
  const expected = [
    [
      [1, 1, 'undead'],
      [2, 6, 'air'],
      [5, 0, 'weapon'],
      [5, 5, 'motion'],
    ],
    [
      [0, 3, 'exchange'],
      [5, 0, 'metal'],
      [5, 6, 'greed'],
    ],
    [
      [1, 1, 'magic'],
      [2, 6, 'order'],
      [5, 0, 'metal'],
      [5, 5, 'exchange'],
    ],
    [
      [1, 1, 'craft'],
      [1, 6, 'greed'],
      [4, 8, 'senses'],
      [6, 0, 'mind'],
      [7, 5, 'exchange'],
    ],
  ]
  for (const [index, anchors] of expected.entries()) {
    for (const [row, column, aspect] of anchors) {
      const cell = cellAt(results[index], row, column)
      assert.equal(cell?.type, 'aspect')
      assert.equal(cell?.aspect, aspect)
    }
  }
})

test('detects missing hexes separately from aspect recognition', () => {
  for (const [index, row, column] of [
    [0, 4, 3],
    [0, 5, 2],
    [1, 1, 2],
    [1, 4, 1],
    [2, 1, 2],
  ]) {
    assert.equal(cellAt(results[index], row, column)?.type, 'obstacle')
  }
  assert.equal(cellAt(results[0], 2, 6)?.type, 'aspect')
  assert.equal(cellAt(results[3], 1, 4)?.type, 'empty')
  assert.equal(cellAt(results[3], 4, 1)?.type, 'empty')
  assert.equal(cellAt(results[3], 7, 2)?.type, 'empty')
})

test('recognizes adjacent missing hexes in a small JPEG screenshot', () => {
  const result = results[4]
  assert.equal(result.geometry.radius, 3)
  assert.equal(result.cells.filter((cell) => cell.type === 'aspect').length, 4)
  assert.equal(cellAt(result, 1, 4)?.type, 'obstacle')
  assert.equal(cellAt(result, 2, 4)?.type, 'obstacle')
  assert.equal(cellAt(result, 5, 2)?.type, 'empty')
})

test('imports only confirmed aspects and obstacles', () => {
  const uncertain = results[0].cells.map((cell) =>
    cell.row === 0 && cell.column === 3 ? { ...cell, type: 'unknown' } : cell,
  )
  assert.throws(
    () => recognizedMapToBoardInput(results[0].geometry.radius, uncertain),
    /Review 1 uncertain cell/,
  )
  const reviewed = uncertain.map((cell) =>
    cell.type === 'unknown' ? { ...cell, type: 'empty' } : cell,
  )
  const input = recognizedMapToBoardInput(results[0].geometry.radius, reviewed)
  assert.equal(input.radius, 3)
  assert.equal(input.cells.filter((cell) => cell.type === 'aspect').length, 4)
  assert.equal(input.cells.filter((cell) => cell.type === 'obstacle').length, 2)
})

test('does not turn faint outlines into obstacles on a large screenshot', () => {
  const result = results[3]
  assert.equal(result.cells.filter((cell) => cell.type === 'unknown').length, 0)
  assert.equal(result.cells.filter((cell) => cell.type === 'obstacle').length, 6)
})

test('recognizes a clear smaller screenshot without changing its radius', async () => {
  const smaller = await sharp(fileURLToPath(fixturePaths[3])).resize({ width: 502 }).toBuffer()
  const result = await recognizeResearchScreenshot(await rasterFromBuffer(smaller), templates)
  assert.equal(result.geometry.radius, 4)
  assert.equal(result.cells.filter((cell) => cell.type === 'aspect').length, 5)
})

test('rejects degraded screenshots instead of importing misleading cells', async () => {
  for (const [label, fixture, operation] of [
    ['small blur', fixturePaths[0], (image) => image.blur(1.5)],
    ['large blur', fixturePaths[3], (image) => image.blur(1.5)],
    ['lossy JPEG', fixturePaths[3], (image) => image.jpeg({ quality: 45 })],
  ]) {
    const degraded = await operation(sharp(fileURLToPath(fixture))).toBuffer()
    await assert.rejects(
      recognizeResearchScreenshot(await rasterFromBuffer(degraded), templates),
      /too unclear|grid could not be found/,
      label,
    )
  }
})

test('radius inference uses the parchment even when outer columns are missing', () => {
  for (const radius of [2, 4]) {
    const stepX = 40
    const stepY = stepX * 1.155
    const paper = {
      x: 20,
      y: 20,
      width: (2 * radius + 5) * stepX,
      height: (2 * radius + 5) * stepY,
    }
    const original = {
      radius,
      center: { x: paper.x + paper.width / 2, y: paper.y + paper.height / 2 },
      stepX,
      stepY,
      paper,
      confidence: 1,
      radiusConfidence: 1,
    }
    const contours = getBoardCells(radius * 2 + 1)
      .filter(({ column }) => column > 0 && column < radius * 2)
      .map(({ row, column }) => ({
        ...cellCenter(original, row, column),
        width: stepX / 0.86,
        height: stepY * 0.9,
      }))
    assert.equal(detectGridGeometry(paper, contours).radius, radius)
  }
})

test('does not infer radius three solely from the parchment size', () => {
  const stepX = 40
  const stepY = stepX * 1.155
  const paper = { x: 20, y: 20, width: 432, height: 440 }
  const grid = {
    radius: 2,
    center: { x: paper.x + paper.width / 2, y: paper.y + paper.height / 2 },
    stepX,
    stepY,
    paper,
    confidence: 1,
    radiusConfidence: 1,
  }
  const contours = getBoardCells(5).map(({ row, column }) => ({
    ...cellCenter(grid, row, column),
    width: stepX / 0.86,
    height: stepY * 0.9,
  }))
  assert.equal(detectGridGeometry(paper, contours).radius, 2)
})

test('ignores an isolated contour outside the grid', () => {
  const stepX = 40
  const stepY = stepX * 1.155
  const paper = { x: 20, y: 20, width: 432, height: 440 }
  const grid = {
    radius: 3,
    center: { x: paper.x + paper.width / 2, y: paper.y + paper.height / 2 },
    stepX,
    stepY,
    paper,
    confidence: 1,
    radiusConfidence: 1,
  }
  const contours = getBoardCells(7).map(({ row, column }) => ({
    ...cellCenter(grid, row, column),
    width: stepX / 0.86,
    height: stepY * 0.9,
  }))
  contours.push({
    x: grid.center.x + 5 * stepX,
    y: grid.center.y + stepY / 2,
    width: stepX / 0.86,
    height: stepY * 0.9,
  })
  assert.equal(detectGridGeometry(paper, contours).radius, 3)
})

test('rejects screenshots without a parchment', async () => {
  const blank = { width: 300, height: 300, data: new Uint8ClampedArray(300 * 300 * 4).fill(255) }
  await assert.rejects(recognizeResearchScreenshot(blank, templates), /Parchment was not found/)
})
