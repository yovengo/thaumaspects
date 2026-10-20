'use client'

import { countForItem } from '@/features/essentia/model/itemQuantity'
import { type ItemAspect, key as itemKey } from '@/features/essentia/model/planner'
import { AspectTag } from '@/features/essentia/shared/AspectVisuals'
import { aspectWord, displayItemName, itemWord } from '@/features/essentia/shared/format'
import { ItemIcon } from '@/features/essentia/shared/ItemIcon'
import { StarIcon } from '@/features/essentia/shared/icons'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'

export function CatalogItem({
  item,
  controller,
}: {
  item: ItemAspect
  controller: ReturnType<typeof useEssentiaPlanner>['catalog']
}) {
  const {
    requestedAspects,
    required,
    catalogNeeded,
    expandedItems,
    preferences,
    variantLabels,
    toggleExpanded,
    chooseItem,
    restoreItem,
    preferItem,
  } = controller
  const overlap = requestedAspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0)
  const coversAll = requestedAspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)
  const count = countForItem(item, coversAll ? required : catalogNeeded)
  const aspectEntries = Object.entries(item.aspects).sort(
    ([a], [b]) => Number(Boolean(required[b])) - Number(Boolean(required[a])) || a.localeCompare(b),
  )
  const key = itemKey(item)
  const expanded = expandedItems.has(key)
  const isPreferred = preferences.preferred.has(key)
  const isExcluded = preferences.excluded.has(key)
  return (
    <div className={`ess-catalog-item ${isExcluded ? 'is-excluded' : ''}`} key={key}>
      <ItemIcon item={item} />
      <div className="ess-catalog-item-body">
        <div className="ess-catalog-name">
          <strong title={displayItemName(item.name)}>{displayItemName(item.name)}</strong>
          {variantLabels.has(key) && <small>{variantLabels.get(key)}</small>}
          {item.aspectVersion && (
            <small
              className="ess-aspect-source"
              title="Aspect profile comes from an earlier GTNH release and is unverified in 2.9"
            >
              GTNH {item.aspectVersion}
            </small>
          )}
          {item.registryId && (
            <small title={item.registryId}>{item.registryId.split(':')[0]}</small>
          )}
        </div>
        <div className="ess-catalog-aspects">
          {(expanded ? aspectEntries : aspectEntries.slice(0, 6)).map(([aspect, amount]) => (
            <AspectTag key={aspect} name={aspect} amount={amount} />
          ))}
          {aspectEntries.length > 6 && (
            <button
              className="ess-more-aspects"
              type="button"
              aria-expanded={expanded}
              onClick={() => toggleExpanded(key)}
            >
              {expanded
                ? 'Collapse'
                : `+${aspectEntries.length - 6} ${aspectWord(aspectEntries.length - 6)}`}
            </button>
          )}
        </div>
      </div>
      <div className="ess-catalog-action">
        <button
          type="button"
          disabled={!overlap || count === null || isExcluded}
          onClick={() => chooseItem(item)}
        >
          {isExcluded
            ? 'Excluded'
            : !overlap
              ? 'Not suitable'
              : count === null
                ? 'Covered'
                : coversAll
                  ? 'Choose mix'
                  : `Add ${count} ${itemWord(count)}`}
        </button>
      </div>
      <button
        className={`ess-availability-button ${isPreferred ? 'is-preferred' : ''}`}
        type="button"
        aria-label={
          isExcluded
            ? `Restore ${displayItemName(item.name)} to recommendations`
            : isPreferred
              ? `Remove preference for ${displayItemName(item.name)}`
              : `Prefer ${displayItemName(item.name)}`
        }
        aria-pressed={isPreferred}
        title={
          isExcluded
            ? 'Restore to recommendations'
            : isPreferred
              ? 'Remove abundant item mark'
              : 'Have plenty — prefer in recommendations'
        }
        onClick={() => (isExcluded ? restoreItem(item) : preferItem(item))}
      >
        {isExcluded ? <span aria-hidden="true">↶</span> : <StarIcon filled={isPreferred} />}
      </button>
    </div>
  )
}
