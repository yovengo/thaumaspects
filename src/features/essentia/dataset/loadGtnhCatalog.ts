import { GTNH_DATASET_BASE_URL } from '@/features/essentia/dataset/gtnhDataset'
import type { Catalog } from '@/features/essentia/model/types'

export function loadGtnhCatalog(signal?: AbortSignal): Promise<Catalog> {
  if (!GTNH_DATASET_BASE_URL) {
    return Promise.reject(new Error('GTNH dataset URL is not configured'))
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./catalogLoader.worker.ts', import.meta.url))
    const cancel = () => {
      worker.terminate()
      reject(new DOMException('Catalog load cancelled', 'AbortError'))
    }
    const finish = () => {
      signal?.removeEventListener('abort', cancel)
      worker.terminate()
    }
    if (signal?.aborted) {
      cancel()
      return
    }
    signal?.addEventListener('abort', cancel, { once: true })
    worker.onmessage = (
      event: MessageEvent<{ type: 'ready'; catalog: Catalog } | { type: 'error'; message: string }>,
    ) => {
      finish()
      if (event.data.type === 'ready') resolve(event.data.catalog)
      else reject(new Error(event.data.message))
    }
    worker.onerror = () => {
      finish()
      reject(new Error('Unable to load the GTNH 2.9.0 catalog'))
    }
    worker.postMessage({
      dataBase:
        process.env.NODE_ENV === 'development' ? '/api/gtnh-dataset' : GTNH_DATASET_BASE_URL,
      iconBase: GTNH_DATASET_BASE_URL,
    })
  })
}
