import { type GtnhCatalog, gtnhIconUrl } from '../dataset/gtnhDataset.ts'
import { prepareItems } from './itemRanking.ts'
import type { ItemAspect } from './plannerTypes.ts'
import type { Catalog } from './types.ts'

export function prepareGtnhCatalog(
  source: GtnhCatalog,
  itemTypes: ReadonlyMap<string, string>,
  baseUrl: string,
): Catalog {
  const items: ItemAspect[] = source.items.map((profile) => {
    const iconUrl = gtnhIconUrl(baseUrl, profile)
    return {
      name: profile.name,
      registryId: profile.id,
      sourceClass: itemTypes.get(profile.registryName),
      aspects: Object.fromEntries(
        Object.entries(profile.aspects).filter(([, amount]) => amount > 0),
      ),
      icon: iconUrl ? { kind: 'remote', url: iconUrl, quality: 'exact' } : undefined,
    }
  })

  return {
    aspects: source.aspects,
    items: prepareItems(items),
    aspectSource: { version: source.source.targetGtnhVersion, count: items.length },
  }
}
