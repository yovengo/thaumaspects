'use client'

import { useEffect, useRef, useState } from 'react'
import type { Requirement } from '@/features/essentia/model/planner'
import type {
  Availability,
  Catalog,
  CatalogFilter,
  CatalogSort,
  IndexResult,
  PlanJob,
  PlanResult,
  WorkerResult,
} from '@/features/essentia/model/types'
import {
  getCachedCatalog,
  getCachedPlan,
  getCachedSources,
  getPlannerWorker,
  subscribePlannerWorker,
} from '@/features/essentia/worker/plannerWorkerClient'

type PlannerResultsInput = {
  catalog: Catalog | null
  required: Requirement
  requestedAspects: string[]
  requestedTotal: number
  availability: Availability
  query: string
  activeCatalogFilter: CatalogFilter
  catalogSort: CatalogSort
  catalogOpen: boolean
  sourceQuery: string
  sourcePickerOpen: boolean
}

export function usePlannerResults({
  catalog,
  required,
  requestedAspects,
  requestedTotal,
  availability,
  query,
  activeCatalogFilter,
  catalogSort,
  catalogOpen,
  sourceQuery,
  sourcePickerOpen,
}: PlannerResultsInput) {
  const [latestPlanResult, setPlanResult] = useState<PlanResult | null>(null)
  const [latestCatalogResult, setCatalogResult] = useState<IndexResult | null>(null)
  const [latestSourceResult, setSourceResult] = useState<IndexResult | null>(null)
  const [workerFailed, setWorkerFailed] = useState(false)
  const plannerWorker = useRef<Worker | null>(null)
  const activePlanJob = useRef<string | null>(null)
  const pendingPlanJob = useRef<PlanJob | null>(null)
  const latestPlanRequest = useRef('')
  const latestCatalogRequest = useRef('')
  const latestSourceRequest = useRef('')
  const planRequest = JSON.stringify([
    required,
    availability.stage,
    availability.preferred,
    availability.excluded,
  ])
  const planResult = (catalog && getCachedPlan(catalog.items, planRequest)) || latestPlanResult
  useEffect(() => {
    latestPlanRequest.current = planRequest
  }, [planRequest])
  useEffect(() => {
    if (!catalog) return
    const worker = getPlannerWorker(catalog.items)
    plannerWorker.current = worker
    const onResult = (result: WorkerResult) => {
      if (result.type === 'calculate') {
        if (result.request === latestPlanRequest.current) {
          if (result.partial) {
            setPlanResult((previous) => (previous?.plans.length ? previous : result))
            return
          }
          setPlanResult(result)
        }
        if (result.partial) return
        if (activePlanJob.current && activePlanJob.current !== result.request) return
        activePlanJob.current = null
        const next = pendingPlanJob.current
        if (next && next.request !== result.request) {
          pendingPlanJob.current = null
          activePlanJob.current = next.request
          worker.postMessage(next)
        } else pendingPlanJob.current = null
      } else if (result.type === 'catalog' && result.request === latestCatalogRequest.current)
        setCatalogResult(result)
      else if (result.type === 'sources' && result.request === latestSourceRequest.current)
        setSourceResult(result)
    }
    const onError = () => setWorkerFailed(true)
    const unsubscribe = subscribePlannerWorker(onResult, onError)
    return () => {
      unsubscribe()
      plannerWorker.current = null
      activePlanJob.current = null
      pendingPlanJob.current = null
    }
  }, [catalog])
  useEffect(() => {
    if (!catalog || requestedTotal <= 0) {
      pendingPlanJob.current = null
      return
    }
    if (getCachedPlan(catalog.items, planRequest)) {
      pendingPlanJob.current = null
      return
    }
    pendingPlanJob.current = {
      type: 'calculate',
      request: planRequest,
      required,
      preferences: {
        preferred: availability.preferred,
        excluded: availability.excluded,
        stage: availability.stage,
      },
    }
    const timer = window.setTimeout(() => {
      if (activePlanJob.current || !pendingPlanJob.current) return
      const next = pendingPlanJob.current
      pendingPlanJob.current = null
      activePlanJob.current = next.request
      plannerWorker.current?.postMessage(next)
    }, 90)
    return () => window.clearTimeout(timer)
  }, [catalog, planRequest, required, requestedTotal, availability])
  const calculating = Boolean(
    catalog && requestedTotal > 0 && !workerFailed && planResult?.request !== planRequest,
  )
  const refining = planResult?.request === planRequest && planResult.partial
  const plans = requestedTotal <= 0 || workerFailed ? [] : (planResult?.plans ?? [])
  const catalogRequest = JSON.stringify([
    query,
    activeCatalogFilter,
    catalogSort,
    required,
    availability,
  ])
  const sourceRequest = JSON.stringify([sourceQuery, requestedAspects, availability])
  const catalogResult =
    (catalog && getCachedCatalog(catalog.items, catalogRequest)) || latestCatalogResult
  const sourceResult =
    (catalog && getCachedSources(catalog.items, sourceRequest)) || latestSourceResult
  useEffect(() => {
    latestCatalogRequest.current = catalogRequest
  }, [catalogRequest])
  useEffect(() => {
    latestSourceRequest.current = sourceRequest
  }, [sourceRequest])
  useEffect(() => {
    if (!catalog || !catalogOpen) return
    if (getCachedCatalog(catalog.items, catalogRequest)) return
    const timer = window.setTimeout(
      () =>
        plannerWorker.current?.postMessage({
          type: 'catalog',
          request: catalogRequest,
          required,
          query,
          filter: activeCatalogFilter,
          sort: catalogSort,
          preferences: availability,
        }),
      60,
    )
    return () => window.clearTimeout(timer)
  }, [
    catalog,
    catalogOpen,
    catalogRequest,
    required,
    query,
    activeCatalogFilter,
    catalogSort,
    availability,
  ])
  useEffect(() => {
    if (!catalog || !sourcePickerOpen || requestedAspects.length === 0) return
    if (getCachedSources(catalog.items, sourceRequest)) return
    const timer = window.setTimeout(
      () =>
        plannerWorker.current?.postMessage({
          type: 'sources',
          request: sourceRequest,
          aspects: requestedAspects,
          query: sourceQuery,
          preferences: availability,
        }),
      60,
    )
    return () => window.clearTimeout(timer)
  }, [catalog, sourcePickerOpen, sourceRequest, sourceQuery, requestedAspects, availability])
  return {
    workerFailed,
    planRequest,
    planResult,
    calculating,
    refining,
    plans,
    catalogRequest,
    sourceRequest,
    catalogResult,
    sourceResult,
  }
}
