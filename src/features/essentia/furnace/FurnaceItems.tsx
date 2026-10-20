'use client'

import type { Plan } from '@/features/essentia/model/planner'
import { key as itemKey } from '@/features/essentia/model/planner'
import { AspectTag } from '@/features/essentia/shared/AspectVisuals'
import { aspectWord, displayItemName, itemWord } from '@/features/essentia/shared/format'
import { ItemIcon } from '@/features/essentia/shared/ItemIcon'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'

export function FurnaceItems({
  selected,
  controller,
}: {
  selected: Plan
  controller: ReturnType<typeof useEssentiaPlanner>['furnace']
}) {
  const {
    selectedId,
    resultRequired,
    expandedItems,
    toggleExpanded,
    updateCustomCount,
    excludeItem,
  } = controller
  return (
    <div className="ess-result-items">
      <div className="ess-picked-head">
        <span className="ess-pick-label">
          {selectedId === 'custom' ? 'Your selection' : selected.title}
        </span>
        <strong>
          {selected.itemCount.toLocaleString('en-US')} <small>{itemWord(selected.itemCount)}</small>
        </strong>
      </div>
      <div className="ess-picked-items">
        {selected.lines.map(({ item, count }) => {
          const id = itemKey(item)
          const aspectEntries = Object.entries(item.aspects).sort(
            ([a], [b]) =>
              Number(Boolean(resultRequired[b])) - Number(Boolean(resultRequired[a])) ||
              a.localeCompare(b),
          )
          const expanded = expandedItems.has(id)
          return (
            <div className="ess-picked-item" key={id}>
              <ItemIcon item={item} large />
              <div className="ess-picked-item-details">
                <strong title={displayItemName(item.name)}>{displayItemName(item.name)}</strong>
                {item.aspectVersion && (
                  <small
                    className="ess-aspect-source"
                    title="Aspect profile comes from an earlier GTNH release and is unverified in 2.9"
                  >
                    GTNH {item.aspectVersion}
                  </small>
                )}
                <div className="ess-picked-aspects">
                  {(expanded ? aspectEntries : aspectEntries.slice(0, 6)).map(
                    ([aspect, amount]) => (
                      <AspectTag key={aspect} name={aspect} amount={amount} />
                    ),
                  )}
                  {aspectEntries.length > 6 && (
                    <button
                      className="ess-more-aspects"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => toggleExpanded(id)}
                    >
                      {expanded
                        ? 'Collapse'
                        : `+${aspectEntries.length - 6} ${aspectWord(aspectEntries.length - 6)}`}
                    </button>
                  )}
                </div>
              </div>
              {selectedId === 'custom' ? (
                <div className="ess-count-stepper">
                  <button
                    type="button"
                    aria-label={`Decrease ${displayItemName(item.name)}`}
                    onClick={() => updateCustomCount(item, count - 1)}
                  >
                    −
                  </button>
                  <b>{count}</b>
                  <button
                    type="button"
                    aria-label={`Increase ${displayItemName(item.name)}`}
                    onClick={() => updateCustomCount(item, count + 1)}
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="ess-item-tools">
                  <b className="ess-item-count">× {count}</b>
                  <button type="button" onClick={() => excludeItem(item)}>
                    Not available
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {selected.lines.some(({ item }) => item.aspectVersion) && (
        <p className="ess-source-note">GTNH 2.8 aspect values · unverified in 2.9</p>
      )}
    </div>
  )
}
