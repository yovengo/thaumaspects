import type { Mat } from '@techstark/opencv-js'
import { aspectIconUrl } from '@/features/research-map/model/catalog'
import type { Cv } from '@/features/research-map/recognition/opencv'
import type { ImageRaster } from '@/features/research-map/recognition/types'

export type AspectTemplate = { aspect: string; image: ImageRaster }
export type PreparedTemplate = { aspect: string; image: Mat }

let cachedTemplates: Promise<AspectTemplate[]> | null = null

async function fetchTemplate(aspect: string): Promise<AspectTemplate | null> {
  const response = await fetch(aspectIconUrl(aspect))
  if (!response.ok) return null
  const bitmap = await createImageBitmap(await response.blob())
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Image processing is unavailable in this browser.')
    context.drawImage(bitmap, 0, 0)
    return { aspect, image: context.getImageData(0, 0, canvas.width, canvas.height) }
  } finally {
    bitmap.close()
  }
}

export function loadAspectTemplates(aspects: string[]): Promise<AspectTemplate[]> {
  if (!cachedTemplates) {
    cachedTemplates = (async () => {
      const templates: AspectTemplate[] = []
      for (let index = 0; index < aspects.length; index += 12) {
        const batch = await Promise.all(aspects.slice(index, index + 12).map(fetchTemplate))
        templates.push(...batch.filter((template): template is AspectTemplate => template !== null))
      }
      if (templates.length < 10) throw new Error('Aspect templates could not be loaded.')
      return templates
    })().catch((error: unknown) => {
      cachedTemplates = null
      throw error
    })
  }
  return cachedTemplates
}

export function prepareTemplates(
  cv: Cv,
  templates: AspectTemplate[],
  stepX: number,
  paperColor: [number, number, number],
): PreparedTemplate[] {
  const prepared: PreparedTemplate[] = []
  try {
    for (const template of templates) {
      const rgba = cv.matFromImageData(template.image as ImageData)
      try {
        for (const scale of [1.08, 1.16, 1.24]) {
          const size = Math.max(12, Math.round(stepX * scale))
          const resized = new cv.Mat()
          const flattened = new cv.Mat(size, size, cv.CV_8UC4)
          const rgb = new cv.Mat()
          try {
            cv.resize(rgba, resized, new cv.Size(size, size), 0, 0, cv.INTER_LINEAR)
            for (let pixel = 0; pixel < size * size; pixel += 1) {
              const offset = pixel * 4
              const alpha = resized.data[offset + 3] / 255
              for (let channel = 0; channel < 3; channel += 1) {
                flattened.data[offset + channel] = Math.round(
                  resized.data[offset + channel] * alpha + paperColor[channel] * (1 - alpha),
                )
              }
              flattened.data[offset + 3] = 255
            }
            cv.cvtColor(flattened, rgb, cv.COLOR_RGBA2RGB)
            prepared.push({ aspect: template.aspect, image: rgb.clone() })
          } finally {
            resized.delete()
            flattened.delete()
            rgb.delete()
          }
        }
      } finally {
        rgba.delete()
      }
    }
    return prepared
  } catch (error) {
    for (const template of prepared) template.image.delete()
    throw error
  }
}
