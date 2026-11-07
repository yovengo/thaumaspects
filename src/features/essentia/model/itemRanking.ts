import type { ItemAspect, PlannerPreferences } from './plannerTypes.ts'

const effortCache = new WeakMap<ItemAspect, number>()
const keyCache = new WeakMap<ItemAspect, string>()

function sourceEffort(item: ItemAspect): number {
  const cached = effortCache.get(item)
  if (cached !== undefined) return cached

  const totalAspects = Object.values(item.aspects).reduce((sum, amount) => sum + amount, 0)
  const minecraft = item.registryId?.startsWith('minecraft:') ?? false
  const itemClass = item.sourceClass ?? ''
  const simpleItem =
    /Item(?:Resin|Crop|Seed|Berry|Fruit|Sapling|Reed)$/.test(itemClass) ||
    (minecraft && !/(?:ItemBlock|ItemPiston|ItemColored|ItemDoublePlant|DoorItem)$/.test(itemClass))
  let effort = simpleItem ? 1 + 0.18 * totalAspects ** 1.35 : 12 + 0.55 * totalAspects ** 1.45

  if (/Item(?:Potion|EnchantedBook|Record|Armor|Sword|Tool|Bow)/.test(itemClass)) effort += 40
  if (item.registryId?.includes('#')) effort += 40
  if (simpleItem && itemClass.endsWith('ItemReed')) effort *= 0.8
  if (simpleItem) {
    const metadata = Number(item.registryId?.match(/@(\d+)/)?.[1] ?? 0)
    effort += Math.min(8, metadata) * 0.4
  }

  effortCache.set(item, effort)
  return effort
}

export function itemEffort(item: ItemAspect, preferences: PlannerPreferences = {}) {
  const effort = sourceEffort(item)
  return preferences.preferred?.has(key(item)) ? effort * 0.65 : effort
}

export const itemSimplicity = (item: ItemAspect, preferences: PlannerPreferences = {}) =>
  itemEffort(item, preferences)

export function key(item: ItemAspect) {
  const cached = keyCache.get(item)
  if (cached !== undefined) return cached
  const value = item.registryId
    ? `gtnh:2.9.0:${item.registryId}`
    : `${item.name}|${Object.entries(item.aspects)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([aspect, amount]) => `${aspect}:${amount}`)
        .join(',')}`
  keyCache.set(item, value)
  return value
}

export function prepareItems(items: ItemAspect[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.name || !Object.values(item.aspects).some((amount) => amount > 0)) return false
    const id = key(item)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}
