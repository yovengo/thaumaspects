import { aspectIconUrl } from '../../../lib/catalog'
import { canvasFor, clamp } from './imageProcessing'

type AspectTemplate = {
  aspect: string
  alpha: Float32Array
  red: Float32Array
  green: Float32Array
  blue: Float32Array
}

type Patch = {
  data: ImageData
  background: [number, number, number]
  foreground: Uint8Array
  salience: number
  x: number
  y: number
}

function median(values: number[]) {
  values.sort((left, right) => left - right)
  return values[Math.floor(values.length / 2)]
}

export async function loadAspectTemplates(aspects: string[]) {
  const loaded = await Promise.all(aspects.map(async (aspect): Promise<AspectTemplate | null> => {
    try {
      const image = new Image()
      image.src = aspectIconUrl(aspect)
      await image.decode()
      const { context } = canvasFor(32, 32)
      context.drawImage(image, 0, 0, 32, 32)
      const pixels = context.getImageData(0, 0, 32, 32).data
      const alpha = new Float32Array(32 * 32)
      const red = new Float32Array(32 * 32)
      const green = new Float32Array(32 * 32)
      const blue = new Float32Array(32 * 32)
      for (let index = 0; index < alpha.length; index += 1) {
        alpha[index] = pixels[index * 4 + 3] / 255
        red[index] = pixels[index * 4]
        green[index] = pixels[index * 4 + 1]
        blue[index] = pixels[index * 4 + 2]
      }
      return { aspect, alpha, red, green, blue }
    } catch {
      return null
    }
  }))
  return loaded.filter((template): template is AspectTemplate => Boolean(template))
}

function samplePatch(source: HTMLCanvasElement, x: number, y: number, size: number): Patch {
  const { context } = canvasFor(32, 32)
  context.imageSmoothingEnabled = true
  context.drawImage(source, x - size / 2, y - size / 2, size, size, 0, 0, 32, 32)
  const data = context.getImageData(0, 0, 32, 32)
  const border: [number[], number[], number[]] = [[], [], []]
  for (let patchY = 0; patchY < 32; patchY += 1) {
    for (let patchX = 0; patchX < 32; patchX += 1) {
      if (patchX >= 4 && patchX < 28 && patchY >= 4 && patchY < 28) continue
      const offset = (patchY * 32 + patchX) * 4
      border[0].push(data.data[offset])
      border[1].push(data.data[offset + 1])
      border[2].push(data.data[offset + 2])
    }
  }
  const background: [number, number, number] = [median(border[0]), median(border[1]), median(border[2])]
  const foreground = new Uint8Array(32 * 32)
  let salience = 0
  let samples = 0
  for (let patchY = 3; patchY < 29; patchY += 1) {
    for (let patchX = 3; patchX < 29; patchX += 1) {
      if (Math.hypot(patchX - 15.5, patchY - 15.5) > 12) continue
      const index = patchY * 32 + patchX
      const offset = index * 4
      const difference = Math.hypot(
        data.data[offset] - background[0],
        data.data[offset + 1] - background[1],
        data.data[offset + 2] - background[2],
      )
      if (difference > 42) foreground[index] = 1
      salience += Math.min(1, difference / 110)
      samples += 1
    }
  }
  return { data, background, foreground, salience: salience / Math.max(1, samples), x, y }
}

function hasNeighbor(mask: Uint8Array, x: number, y: number) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const nextX = x + offsetX
      const nextY = y + offsetY
      if (nextX >= 0 && nextX < 32 && nextY >= 0 && nextY < 32 && mask[nextY * 32 + nextX]) return true
    }
  }
  return false
}

function compare(template: AspectTemplate, patch: Patch) {
  let dot = 0
  let observedSquared = 0
  let expectedSquared = 0
  let templatePixels = 0
  let coveredTemplate = 0
  let foregroundPixels = 0
  let coveredForeground = 0
  const templateMask = new Uint8Array(32 * 32)
  for (let index = 0; index < template.alpha.length; index += 1) {
    if (template.alpha[index] >= 0.2) templateMask[index] = 1
  }

  for (let y = 2; y < 30; y += 1) {
    for (let x = 2; x < 30; x += 1) {
      if (Math.hypot(x - 15.5, y - 15.5) > 13) continue
      const index = y * 32 + x
      const offset = index * 4
      const alpha = template.alpha[index]
      const observed = [
        patch.data.data[offset] - patch.background[0],
        patch.data.data[offset + 1] - patch.background[1],
        patch.data.data[offset + 2] - patch.background[2],
      ]
      const expected = [
        alpha * (template.red[index] - patch.background[0]),
        alpha * (template.green[index] - patch.background[1]),
        alpha * (template.blue[index] - patch.background[2]),
      ]
      if (alpha >= 0.08 || patch.foreground[index]) {
        dot += observed[0] * expected[0] + observed[1] * expected[1] + observed[2] * expected[2]
        observedSquared += observed[0] ** 2 + observed[1] ** 2 + observed[2] ** 2
        expectedSquared += expected[0] ** 2 + expected[1] ** 2 + expected[2] ** 2
      }
      if (templateMask[index]) {
        templatePixels += 1
        if (hasNeighbor(patch.foreground, x, y)) coveredTemplate += 1
      }
      if (patch.foreground[index]) {
        foregroundPixels += 1
        if (hasNeighbor(templateMask, x, y)) coveredForeground += 1
      }
    }
  }
  const cosine = dot / Math.max(1, Math.sqrt(observedSquared * expectedSquared))
  const recall = coveredTemplate / Math.max(1, templatePixels)
  const precision = coveredForeground / Math.max(1, foregroundPixels)
  const shape = 2 * precision * recall / Math.max(0.001, precision + recall)
  return clamp(Math.max(0, cosine) * 0.72 + shape * 0.28, 0, 1)
}

export function recognizeTemplateAt(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  templates: AspectTemplate[],
) {
  const patches: Patch[] = []
  for (const scale of [1.55, 1.8, 2.05, 2.3]) {
    for (const offsetX of [-radius * 0.22, 0, radius * 0.22]) {
      for (const offsetY of [-radius * 0.22, 0, radius * 0.22]) {
        patches.push(samplePatch(source, x + offsetX, y + offsetY, radius * scale))
      }
    }
  }
  const candidates = patches.sort((left, right) => right.salience - left.salience).slice(0, 5)
  let best = { aspect: '', score: 0, margin: 0, salience: 0, matchX: x, matchY: y }
  for (const patch of candidates) {
    const ranked = templates.map((template) => ({ aspect: template.aspect, score: compare(template, patch) }))
      .sort((left, right) => right.score - left.score)
    const [winner, runnerUp] = ranked
    if (!winner || winner.score <= best.score) continue
    best = {
      aspect: winner.aspect,
      score: winner.score,
      margin: winner.score - (runnerUp?.score ?? 0),
      salience: patch.salience,
      matchX: patch.x,
      matchY: patch.y,
    }
  }
  return best
}
