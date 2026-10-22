import type { Mat } from '@techstark/opencv-js'
import type { Cv } from '@/features/research-map/recognition/opencv'
import type { HexContour, ImageRaster, Rectangle } from '@/features/research-map/recognition/types'

function median(values: number[]) {
  const sorted = values.sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function debugRaster(cv: Cv, mat: Mat): ImageRaster {
  const scale = Math.min(1, 900 / Math.max(mat.cols, mat.rows))
  const resized = new cv.Mat()
  cv.resize(
    mat,
    resized,
    new cv.Size(Math.round(mat.cols * scale), Math.round(mat.rows * scale)),
    0,
    0,
    cv.INTER_AREA,
  )
  const data = new Uint8ClampedArray(resized.cols * resized.rows * 4)
  for (let index = 0; index < resized.data.length; index += 1) {
    const offset = index * 4
    data[offset] = resized.data[index]
    data[offset + 1] = resized.data[index]
    data[offset + 2] = resized.data[index]
    data[offset + 3] = 255
  }
  const raster = { data, width: resized.cols, height: resized.rows }
  resized.delete()
  return raster
}

function detailScore(
  raster: ImageRaster,
  paper: Rectangle,
  sourceWidth: number,
  sourceHeight: number,
) {
  let contrast = 0
  let samples = 0
  const scaleX = raster.width / sourceWidth
  const scaleY = raster.height / sourceHeight
  const left = Math.max(2, Math.round((paper.x + paper.width * 0.1) * scaleX))
  const right = Math.min(raster.width - 2, Math.round((paper.x + paper.width * 0.9) * scaleX))
  const top = Math.max(2, Math.round((paper.y + paper.height * 0.1) * scaleY))
  const bottom = Math.min(raster.height - 2, Math.round((paper.y + paper.height * 0.9) * scaleY))
  for (let y = top; y < bottom; y += 3) {
    for (let x = left; x < right; x += 3) {
      const offset = (y * raster.width + x) * 4
      const rowOffset = raster.width * 4
      contrast += Math.abs(
        4 * raster.data[offset] -
          raster.data[offset - 4] -
          raster.data[offset + 4] -
          raster.data[offset - rowOffset] -
          raster.data[offset + rowOffset],
      )
      samples += 1
    }
  }
  return samples ? contrast / samples : 0
}

function detectPaper(cv: Cv, rgba: Mat) {
  const rgb = new cv.Mat()
  const hsv = new cv.Mat()
  const mask = new cv.Mat()
  const lower = new cv.Mat(rgba.rows, rgba.cols, cv.CV_8UC3, new cv.Scalar(8, 40, 90))
  const upper = new cv.Mat(rgba.rows, rgba.cols, cv.CV_8UC3, new cv.Scalar(42, 255, 255))
  const kernelSize = Math.max(3, Math.round(Math.min(rgba.rows, rgba.cols) * 0.02) | 1)
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize))
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB)
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)
    cv.inRange(hsv, lower, upper, mask)
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel)
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    let coarse: Rectangle | null = null
    let largestArea = 0
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index)
      const rect = cv.boundingRect(contour)
      const area = cv.contourArea(contour)
      contour.delete()
      if (area > largestArea && rect.width / rect.height > 0.65 && rect.width / rect.height < 1.4) {
        largestArea = area
        coarse = rect
      }
    }
    if (!coarse || largestArea < rgba.rows * rgba.cols * 0.015) {
      throw new Error('Parchment was not found in the screenshot.')
    }

    const columnCounts: number[] = []
    const rowCounts: number[] = []
    for (let x = coarse.x; x < coarse.x + coarse.width; x += 1) {
      let count = 0
      for (let y = coarse.y; y < coarse.y + coarse.height; y += 1) {
        if (mask.data[y * mask.cols + x]) count += 1
      }
      columnCounts.push(count)
    }
    for (let y = coarse.y; y < coarse.y + coarse.height; y += 1) {
      let count = 0
      for (let x = coarse.x; x < coarse.x + coarse.width; x += 1) {
        if (mask.data[y * mask.cols + x]) count += 1
      }
      rowCounts.push(count)
    }

    const columnThreshold = Math.max(...columnCounts) * 0.45
    const rowThreshold = Math.max(...rowCounts) * 0.45
    const usefulColumns = columnCounts
      .map((count, index) => (count > columnThreshold ? coarse.x + index : -1))
      .filter((position) => position >= 0)
    const usefulRows = rowCounts
      .map((count, index) => (count > rowThreshold ? coarse.y + index : -1))
      .filter((position) => position >= 0)
    if (!usefulColumns.length || !usefulRows.length) {
      throw new Error('Parchment boundaries could not be measured.')
    }
    const paper: Rectangle = {
      x: usefulColumns[0],
      y: usefulRows[0],
      width: usefulColumns[usefulColumns.length - 1] - usefulColumns[0] + 1,
      height: usefulRows[usefulRows.length - 1] - usefulRows[0] + 1,
    }

    const samples: [number[], number[], number[]] = [[], [], []]
    for (
      let y = paper.y + Math.round(paper.height * 0.1);
      y < paper.y + paper.height * 0.9;
      y += 4
    ) {
      for (
        let x = paper.x + Math.round(paper.width * 0.1);
        x < paper.x + paper.width * 0.9;
        x += 4
      ) {
        if (!mask.data[y * mask.cols + x]) continue
        const offset = (y * rgba.cols + x) * 4
        for (let channel = 0; channel < 3; channel += 1) {
          samples[channel].push(rgba.data[offset + channel])
        }
      }
    }
    const paperColor = samples.map(median) as [number, number, number]
    return { paper, paperColor }
  } finally {
    rgb.delete()
    hsv.delete()
    mask.delete()
    lower.delete()
    upper.delete()
    kernel.delete()
    contours.delete()
    hierarchy.delete()
  }
}

function detectHexContours(cv: Cv, edges: Mat, paper: Rectangle, sensitive: boolean): HexContour[] {
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const hexes: HexContour[] = []
  try {
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index)
      const rect = cv.boundingRect(contour)
      const area = cv.contourArea(contour)
      const perimeter = cv.arcLength(contour, true)
      const polygon = new cv.Mat()
      cv.approxPolyDP(contour, polygon, perimeter * 0.035, true)
      const x = rect.x + rect.width / 2
      const y = rect.y + rect.height / 2
      if (
        x > paper.x + paper.width * 0.07 &&
        x < paper.x + paper.width * 0.93 &&
        y > paper.y + paper.height * 0.07 &&
        y < paper.y + paper.height * 0.93 &&
        rect.width >= Math.max(12, paper.width * 0.04) &&
        rect.width <= paper.width * 0.16 &&
        rect.height >= Math.max(12, paper.height * 0.04) &&
        rect.height <= paper.height * 0.16 &&
        rect.width / rect.height > 0.75 &&
        rect.width / rect.height < 1.25 &&
        polygon.rows >= (sensitive ? 4 : 5) &&
        polygon.rows <= (sensitive ? 12 : 9) &&
        area / (rect.width * rect.height) > (sensitive ? 0.25 : 0.4)
      ) {
        hexes.push({ x, y, width: rect.width, height: rect.height })
      }
      polygon.delete()
      contour.delete()
    }
    return hexes
  } finally {
    contours.delete()
    hierarchy.delete()
  }
}

export function preprocessScreenshot(cv: Cv, rgba: Mat, sensitive = false) {
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const rgb = new cv.Mat()
  try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY)
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB)
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0)
    cv.Canny(blurred, edges, sensitive ? 18 : 35, sensitive ? 55 : 100)
    const { paper, paperColor } = detectPaper(cv, rgba)
    const contours = detectHexContours(cv, edges, paper, sensitive)
    const grayscale = debugRaster(cv, gray)
    return {
      rgb,
      edges,
      paper,
      paperColor,
      contours,
      detail: detailScore(grayscale, paper, gray.cols, gray.rows),
      debug: { grayscale, edges: debugRaster(cv, edges), contours },
    }
  } catch (error) {
    rgb.delete()
    edges.delete()
    throw error
  } finally {
    gray.delete()
    blurred.delete()
  }
}
