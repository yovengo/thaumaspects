import { key } from '../model/itemRanking.ts'
import type { ItemAspect } from '../model/plannerTypes.ts'
import type { Availability } from '../model/types.ts'
import legacyAliases from './legacyPreferenceAliases.json' with { type: 'json' }

type PreferenceKeys = {
  byLegacyId: Map<string, string>
  currentIds: Set<string>
}

const preferenceKeyCache = new WeakMap<ItemAspect[], PreferenceKeys>()

function oldKey(item: ItemAspect): string {
  return `${item.registryId}|${Object.entries(item.aspects)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([aspect, amount]) => `${aspect}:${amount}`)
    .join(',')}`
}

export function migratePreferences(availability: Availability, items: ItemAspect[]): Availability {
  let keys = preferenceKeyCache.get(items)
  if (!keys) {
    keys = {
      byLegacyId: new Map(items.map((item) => [oldKey(item), key(item)])),
      currentIds: new Set(items.map((item) => item.registryId).filter((id): id is string => !!id)),
    }
    preferenceKeyCache.set(items, keys)
  }
  const aliases = legacyAliases as Record<string, string>
  const migrate = (saved: string[]) => [
    ...new Set(
      saved.map((id) => {
        const oldId = aliases[id]
        if (oldId && keys.currentIds.has(oldId)) return `gtnh:item:${oldId}`

        const versionedId = /^gtnh:[^:]+:(.+)$/.exec(id)?.[1]
        if (versionedId && keys.currentIds.has(versionedId)) return `gtnh:item:${versionedId}`

        return keys.byLegacyId.get(id) ?? id
      }),
    ),
  ]
  return {
    ...availability,
    preferred: migrate(availability.preferred),
    excluded: migrate(availability.excluded),
  }
}
