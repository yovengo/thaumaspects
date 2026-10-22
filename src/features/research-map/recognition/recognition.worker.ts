import { recognizeResearchScreenshot } from '@/features/research-map/recognition/recognizeScreenshot'
import type { AspectTemplate } from '@/features/research-map/recognition/templates'
import type { ImageRaster } from '@/features/research-map/recognition/types'

type Request = {
  image: ImageRaster
  templates: AspectTemplate[]
  radius?: number
}

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    self.postMessage({ stage: 'Starting image processor' })
    const { image, templates, radius } = event.data
    const result = await recognizeResearchScreenshot(image, templates, radius, (stage) =>
      self.postMessage({ stage }),
    )
    self.postMessage({ result })
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : 'Recognition failed.' })
  }
}
