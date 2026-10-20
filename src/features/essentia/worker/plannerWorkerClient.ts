import type { ItemAspect } from '@/features/essentia/model/planner'
import type { IndexResult, PlanResult, WorkerResult } from '@/features/essentia/model/types'

const resultCacheLimit = 8
let cachedItems: ItemAspect[] | null = null
const cachedPlans = new Map<string, PlanResult>()
const cachedCatalogResults = new Map<string, IndexResult>()
const cachedSourceResults = new Map<string, IndexResult>()
let sharedWorker: Worker | null = null
let sharedWorkerItems: ItemAspect[] | null = null
const workerListeners = new Set<(result: WorkerResult) => void>()
const workerErrorListeners = new Set<() => void>()

function resetResultCacheFor(items: ItemAspect[]) {
  if (cachedItems === items) return
  cachedItems = items
  cachedPlans.clear()
  cachedCatalogResults.clear()
  cachedSourceResults.clear()
}

function cacheResult<T>(cache: Map<string, T>, request: string, result: T) {
  cache.delete(request)
  cache.set(request, result)
  if (cache.size > resultCacheLimit) cache.delete(cache.keys().next().value!)
}

export const getCachedPlan = (items: ItemAspect[], request: string) =>
  cachedItems === items ? cachedPlans.get(request) : undefined
export const getCachedCatalog = (items: ItemAspect[], request: string) =>
  cachedItems === items ? cachedCatalogResults.get(request) : undefined
export const getCachedSources = (items: ItemAspect[], request: string) =>
  cachedItems === items ? cachedSourceResults.get(request) : undefined

export function subscribePlannerWorker(
  onResult: (result: WorkerResult) => void,
  onError: () => void,
) {
  workerListeners.add(onResult)
  workerErrorListeners.add(onError)
  return () => {
    workerListeners.delete(onResult)
    workerErrorListeners.delete(onError)
  }
}

export function getPlannerWorker(items: ItemAspect[]) {
  if (sharedWorker && sharedWorkerItems === items) return sharedWorker
  sharedWorker?.terminate()
  resetResultCacheFor(items)
  const worker = new Worker(new URL('./essentiaPlanner.worker.ts', import.meta.url), {
    type: 'module',
  })
  sharedWorker = worker
  sharedWorkerItems = items
  worker.onmessage = (event: MessageEvent<WorkerResult>) => {
    if (sharedWorker !== worker) return
    const result = event.data
    if (result.type === 'calculate' && !result.partial)
      cacheResult(cachedPlans, result.request, result)
    else if (result.type === 'catalog') cacheResult(cachedCatalogResults, result.request, result)
    else if (result.type === 'sources') cacheResult(cachedSourceResults, result.request, result)
    for (const listener of workerListeners) listener(result)
  }
  worker.onerror = () => {
    if (sharedWorker !== worker) return
    worker.terminate()
    sharedWorker = null
    sharedWorkerItems = null
    for (const listener of workerErrorListeners) listener()
  }
  worker.postMessage({ type: 'init', items })
  return worker
}
