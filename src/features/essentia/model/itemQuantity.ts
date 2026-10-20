import type { ItemAspect, Requirement } from '@/features/essentia/model/planner'

export function countForItem(item: ItemAspect, required: Requirement) {
  const aspects = Object.keys(required).filter(
    (aspect) => required[aspect] > 0 && (item.aspects[aspect] ?? 0) > 0,
  )
  if (aspects.length === 0) return null
  return Math.max(...aspects.map((aspect) => Math.ceil(required[aspect] / item.aspects[aspect])))
}
