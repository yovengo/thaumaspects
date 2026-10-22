import { classifyCells } from '@/features/research-map/recognition/classifyCells'
import { detectGridGeometry } from '@/features/research-map/recognition/geometry'
import { loadOpenCv } from '@/features/research-map/recognition/opencv'
import { preprocessScreenshot } from '@/features/research-map/recognition/preprocess'
import {
  type AspectTemplate,
  prepareTemplates,
} from '@/features/research-map/recognition/templates'
import type { ImageRaster, RecognitionResult } from '@/features/research-map/recognition/types'

type RecognitionAttempt = { result: RecognitionResult; detail: number }

function isUsable({ result, detail }: RecognitionAttempt) {
  const aspectCount = result.cells.filter((cell) => cell.type === 'aspect').length
  const minimumDetail = result.geometry.stepX >= 60 ? 2.5 : 3
  return (
    detail >= minimumDetail &&
    result.geometry.confidence >= 0.45 &&
    (aspectCount >= 2 ||
      (aspectCount === 1 && result.geometry.confidence >= 0.8 && detail >= minimumDetail + 1))
  )
}

export async function recognizeResearchScreenshot(
  image: ImageRaster,
  templates: AspectTemplate[],
  radiusOverride?: number,
  onProgress?: (stage: string) => void,
): Promise<RecognitionResult> {
  if (
    image.width < 200 ||
    image.height < 200 ||
    image.width > 2400 ||
    image.height > 2400 ||
    image.data.length !== image.width * image.height * 4
  ) {
    throw new Error('Use a PNG or JPEG screenshot between 200 and 2400 pixels per side.')
  }
  onProgress?.('Loading OpenCV')
  const { cv } = await loadOpenCv()
  const source = cv.matFromImageData(image as ImageData)
  try {
    const analyze = (sensitive: boolean): RecognitionAttempt => {
      let prepared: ReturnType<typeof prepareTemplates> = []
      const processed = preprocessScreenshot(cv, source, sensitive)
      try {
        const geometry = detectGridGeometry(processed.paper, processed.contours, radiusOverride)
        onProgress?.('Matching aspects')
        prepared = prepareTemplates(cv, templates, geometry.stepX, processed.paperColor)
        const cells = classifyCells(
          cv,
          processed.rgb,
          processed.edges,
          geometry,
          processed.contours,
          prepared,
          processed.paperColor,
        )
        return {
          result: {
            width: image.width,
            height: image.height,
            geometry,
            cells,
            debug: processed.debug,
          },
          detail: processed.detail,
        }
      } finally {
        for (const template of prepared) template.image.delete()
        processed.rgb.delete()
        processed.edges.delete()
      }
    }

    let first: RecognitionAttempt | null = null
    let firstError: unknown
    onProgress?.('Detecting grid')
    try {
      first = analyze(false)
      if (isUsable(first)) return first.result
    } catch (error) {
      firstError = error
    }

    onProgress?.('Checking faint grid lines')
    let second: RecognitionAttempt | null = null
    try {
      second = analyze(true)
    } catch {
      if (!first && firstError) throw firstError
    }

    if (second && isUsable(second)) return second.result
    throw new Error(
      'The screenshot is too unclear to recognize reliably. Try a larger or sharper image.',
    )
  } finally {
    source.delete()
  }
}
