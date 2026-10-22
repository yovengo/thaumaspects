import * as OpenCvModule from '@techstark/opencv-js'

export type Cv = typeof OpenCvModule

let loading: Promise<{ cv: Cv }> | null = null

export function loadOpenCv(): Promise<{ cv: Cv }> {
  if (!loading) {
    const cv = ((OpenCvModule as unknown as { default?: Cv }).default ?? OpenCvModule) as Cv & {
      onRuntimeInitialized?: () => void
      then?: (ready: () => void) => unknown
    }
    loading = new Promise<{ cv: Cv }>((resolve, reject) => {
      const timeout = globalThis.setTimeout(
        () => reject(new Error('OpenCV did not initialize.')),
        30000,
      )
      if (typeof cv.then === 'function') {
        cv.then(() => {
          globalThis.clearTimeout(timeout)
          resolve({ cv })
        })
        return
      }
      if (typeof cv.Mat === 'function') {
        globalThis.clearTimeout(timeout)
        resolve({ cv })
        return
      }
      const previous = cv.onRuntimeInitialized
      cv.onRuntimeInitialized = () => {
        previous?.()
        globalThis.clearTimeout(timeout)
        resolve({ cv })
      }
    }).catch((error: unknown) => {
      loading = null
      throw error
    })
  }
  return loading
}
