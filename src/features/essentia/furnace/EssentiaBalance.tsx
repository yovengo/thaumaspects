'use client'

import type { Plan } from '@/features/essentia/model/planner'
import { AspectIcon, AspectTag } from '@/features/essentia/shared/AspectVisuals'
import { aspectLabel } from '@/features/essentia/shared/format'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'

export function EssentiaBalance({
  selected,
  controller,
}: {
  selected: Plan
  controller: ReturnType<typeof useEssentiaPlanner>['furnace']
}) {
  const { resultAspects, resultRequired, shortage } = controller
  return (
    <div className="ess-result-analysis">
      <div className="ess-progress-list">
        {resultAspects.map((aspect) => {
          const amount = selected.produced[aspect] ?? 0
          const target = resultRequired[aspect]
          return (
            <div className="ess-progress" key={aspect}>
              <AspectIcon name={aspect} />
              <span>{aspectLabel(aspect)}</span>
              <b className={amount < target ? 'is-short' : ''}>
                {amount} / {target}
              </b>
              <div className="ess-progress-track">
                <span style={{ width: `${Math.min(100, (amount / target) * 100)}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      {shortage.length > 0 && (
        <div className="ess-shortage">
          <strong>Missing</strong>
          <span>
            {shortage.map(([aspect, amount]) => `${aspectLabel(aspect)} ${amount}`).join(' · ')}
          </span>
        </div>
      )}
      {selected.extra > 0 && (
        <div className="ess-result-meta">
          <span>+{selected.extra} excess</span>
        </div>
      )}
      {Object.entries(selected.produced).filter(([aspect]) => !resultRequired[aspect]).length >
        0 && (
        <div className="ess-other-aspects">
          <span>Byproducts</span>
          {Object.entries(selected.produced)
            .filter(([aspect]) => !resultRequired[aspect])
            .map(([aspect, amount]) => (
              <AspectTag key={aspect} name={aspect} amount={amount} />
            ))}
        </div>
      )}
    </div>
  )
}
