export type Bounds = { x: number; y: number; width: number; height: number }

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function canvasFor(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available in this browser.')
  return { canvas, context }
}

export async function loadBitmap(source: Blob | File) {
  if ('createImageBitmap' in window) return createImageBitmap(source)
  const url = URL.createObjectURL(source)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function isParchmentPixel(red: number, green: number, blue: number) {
  const lightness = (red + green + blue) / 3
  return lightness > 58 && red > blue * 1.08 && green > blue * 1.01 && red < green * 1.85
}

export function findParchmentBounds(image: ImageData): Bounds {
  const { width, height, data } = image
  const mask = new Uint8Array(width * height)
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4
    mask[index] = isParchmentPixel(data[offset], data[offset + 1], data[offset + 2]) ? 1 : 0
  }

  const seen = new Uint8Array(mask.length)
  const queue = new Int32Array(mask.length)
  let best = { count: 0, minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 }

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue
    let head = 0
    let tail = 0
    queue[tail++] = start
    seen[start] = 1
    let count = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    while (head < tail) {
      const current = queue[head++]
      const x = current % width
      const y = Math.floor(current / width)
      count += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      const neighbors = [current - 1, current + 1, current - width, current + width]
      for (const next of neighbors) {
        if (next < 0 || next >= mask.length || seen[next] || !mask[next]) continue
        if ((next === current - 1 || next === current + 1) && Math.floor(next / width) !== y) continue
        seen[next] = 1
        queue[tail++] = next
      }
    }

    if (count > best.count) best = { count, minX, minY, maxX, maxY }
  }

  const componentWidth = best.maxX - best.minX + 1
  const componentHeight = best.maxY - best.minY + 1
  if (best.count < width * height * 0.025 || componentWidth < width * 0.18 || componentHeight < height * 0.18) {
    return { x: 0, y: 0, width, height }
  }

  const padding = Math.round(Math.min(componentWidth, componentHeight) * 0.025)
  const x = clamp(best.minX - padding, 0, width - 1)
  const y = clamp(best.minY - padding, 0, height - 1)
  return {
    x,
    y,
    width: clamp(best.maxX + padding, 0, width - 1) - x + 1,
    height: clamp(best.maxY + padding, 0, height - 1) - y + 1,
  }
}

export function getEdgeMap(image: ImageData, bounds: Bounds) {
  const { data, width } = image
  const gray = new Float32Array(bounds.width * bounds.height)
  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const source = ((bounds.y + y) * width + bounds.x + x) * 4
      gray[y * bounds.width + x] = data[source] * 0.299 + data[source + 1] * 0.587 + data[source + 2] * 0.114
    }
  }

  const edges = new Uint8Array(gray.length)
  for (let y = 1; y < bounds.height - 1; y += 1) {
    for (let x = 1; x < bounds.width - 1; x += 1) {
      const index = y * bounds.width + x
      const gx = -gray[index - bounds.width - 1] + gray[index - bounds.width + 1]
        - 2 * gray[index - 1] + 2 * gray[index + 1]
        - gray[index + bounds.width - 1] + gray[index + bounds.width + 1]
      const gy = -gray[index - bounds.width - 1] - 2 * gray[index - bounds.width] - gray[index - bounds.width + 1]
        + gray[index + bounds.width - 1] + 2 * gray[index + bounds.width] + gray[index + bounds.width + 1]
      edges[index] = Math.min(255, Math.hypot(gx, gy))
    }
  }
  return edges
}

export function quantile(values: number[], fraction: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}
