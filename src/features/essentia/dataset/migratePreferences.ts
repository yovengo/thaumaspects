import { key } from '../model/itemRanking.ts'
import type { ItemAspect } from '../model/plannerTypes.ts'
import type { Availability } from '../model/types.ts'
import legacyAliases from './legacyPreferenceAliases.json' with { type: 'json' }

const legacyKeys = new WeakMap<ItemAspect[], Map<string, string>>()

function oldKey(item: ItemAspect): string {
  return `${item.registryId}|${Object.entries(item.aspects)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([aspect, amount]) => `${aspect}:${amount}`)
    .join(',')}`
}

export function migratePreferences(availability: Availability, items: ItemAspect[]): Availability {
  let current = legacyKeys.get(items)
  if (!current) {
    current = new Map(items.map((item) => [oldKey(item), key(item)]))
    legacyKeys.set(items, current)
  }
  const aliases = legacyAliases as Record<string, string>
  const migrate = (saved: string[]) => [
    ...new Set(
      saved.map((id) => {
        const oldId = aliases[id]
        return oldId ? `gtnh:2.9.0:${oldId}` : (current.get(id) ?? id)
      }),
    ),
  ]
  return {
    ...availability,
    preferred: migrate(availability.preferred),
    excluded: migrate(availability.excluded),
  }
}
