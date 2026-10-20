'use client'

import { EssentiaBalance } from '@/features/essentia/furnace/EssentiaBalance'
import { FurnaceItems } from '@/features/essentia/furnace/FurnaceItems'
import { SourceBrowser } from '@/features/essentia/furnace/SourceBrowser'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'

export function FurnacePanel({
  controller,
}: {
  controller: ReturnType<typeof useEssentiaPlanner>['furnace']
}) {
  const {
    calculating,
    selectedId,
    setSelectedId,
    selected,
    refining,
    catalog,
    loadError,
    requestedAspects,
    workerFailed,
    planResult,
    planRequest,
    resultRef,
  } = controller
  return (
    <div
      className={`panel ess-result${calculating && selectedId !== 'custom' ? ' is-updating' : ''}`}
      ref={resultRef}
    >
      <div className="ess-section-head">
        <h3>Furnace</h3>
        {selected && selectedId === 'custom' && (
          <button className="ess-reset-plan" type="button" onClick={() => setSelectedId(null)}>
            Restore recommendation
          </button>
        )}
      </div>
      {selectedId !== 'custom' && (refining || (calculating && selected)) && (
        <span className="ess-update-indicator" role="status">
          {refining ? 'Refining…' : 'Updating…'}
        </span>
      )}
      {!catalog && !loadError && requestedAspects.length > 0 && (
        <div className="ess-state">Loading item catalog…</div>
      )}
      {loadError && (
        <div className="ess-state">Could not load the catalog. Please refresh the page.</div>
      )}
      {workerFailed && (
        <div className="ess-state">Calculation unavailable. Please refresh the page.</div>
      )}
      {!loadError && !workerFailed && requestedAspects.length === 0 && (
        <div className="ess-result-empty" role="status">
          <div className="ess-result-empty-slots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span>Awaiting aspects</span>
        </div>
      )}
      {catalog &&
        requestedAspects.length > 0 &&
        calculating &&
        !selected &&
        selectedId !== 'custom' && <div className="ess-state">Calculating a practical mix…</div>}
      {catalog &&
        requestedAspects.length > 0 &&
        !calculating &&
        !workerFailed &&
        !planResult?.error &&
        !selected && (
          <div className="ess-state">No suitable item mix found. Try different aspects.</div>
        )}
      {catalog && planResult?.request === planRequest && planResult.error && (
        <div className="ess-state">Could not calculate a mix. Try changing the target.</div>
      )}
      {selected && (
        <div className="ess-result-body" aria-busy={calculating && selectedId !== 'custom'}>
          <FurnaceItems selected={selected} controller={controller} />
          <EssentiaBalance selected={selected} controller={controller} />
        </div>
      )}
      <SourceBrowser controller={controller} />
    </div>
  )
}
