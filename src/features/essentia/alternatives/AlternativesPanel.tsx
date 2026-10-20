'use client'

import { key as itemKey } from '@/features/essentia/model/planner'
import { displayItemName } from '@/features/essentia/shared/format'
import { ItemIcon } from '@/features/essentia/shared/ItemIcon'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'

export function AlternativesPanel({
  controller,
}: {
  controller: ReturnType<typeof useEssentiaPlanner>['alternatives']
}) {
  const {
    plans,
    calculating,
    selected,
    visiblePlans,
    selectPlan,
    alternativesOpen,
    setAlternativesOpen,
  } = controller
  return (
    <>
      {plans.length > 1 && (
        <section
          className={`panel ess-alternatives${calculating ? ' is-updating' : ''}`}
          aria-label="Alternative item mixes"
        >
          <div className="ess-section-head">
            <h3>Alternatives</h3>
          </div>
          <div className="ess-alternative-grid">
            {visiblePlans.map((plan) => (
              <button
                type="button"
                className={`ess-alternative ${selected?.id === plan.id ? 'is-active' : ''}`}
                key={plan.id}
                onClick={() => selectPlan(plan.id)}
              >
                <span className="ess-alternative-icons">
                  {plan.lines.slice(0, 2).map(({ item }) => (
                    <ItemIcon key={itemKey(item)} item={item} />
                  ))}
                </span>
                <span className="ess-alternative-copy">
                  <strong>{plan.title}</strong>
                  <small>
                    {plan.lines
                      .map(
                        ({ item, count }) =>
                          `${count}× ${displayItemName(item.name)}${item.aspectVersion ? ` [${item.aspectVersion}]` : ''}`,
                      )
                      .join(' + ')}
                  </small>
                </span>
                {plan.extra > 0 && <em>+{plan.extra} excess</em>}
              </button>
            ))}
          </div>
          {plans.length > 3 && (
            <button
              className="ess-more-alternatives"
              type="button"
              aria-expanded={alternativesOpen}
              onClick={() => setAlternativesOpen((open) => !open)}
            >
              {alternativesOpen ? 'Show fewer mixes ↑' : `Show all ${plans.length} mixes ↓`}
            </button>
          )}
        </section>
      )}
    </>
  )
}
