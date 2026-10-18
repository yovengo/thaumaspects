import { addonDictionary } from '@/data/addons.js'
import { translate } from '@/data/aspects.js'
import { gtnhResearchDefinition } from '@/data/versions.js'
import type { AddonDefinition, Catalog, VersionDefinition } from '@/types/domain'

const aspectNames = translate as Record<string, string>
const researchDefinition = gtnhResearchDefinition as unknown as VersionDefinition
export const addonMap = addonDictionary as unknown as Record<string, AddonDefinition>
export const addonEntries = Object.entries(addonMap)

export const aspectLabel = (aspect: string) =>
  `${aspectNames[aspect] ?? aspect}`.replace(/^./, (letter) => letter.toUpperCase())

export const aspectIconUrl = (aspect: string, muted = false) =>
  `/aspects/${muted ? 'mono' : 'color'}/${aspectNames[aspect]}.png`

export function getCatalog(): Catalog {
  const combinations = { ...researchDefinition.combinations }
  const addonAspects: string[] = []

  addonEntries.forEach(([, addon]) => {
    Object.assign(combinations, addon.combinations)
    addonAspects.push(...addon.aspects)
  })

  return {
    combinations,
    aspects: [
      ...new Set([
        ...researchDefinition.base_aspects,
        ...Object.keys(researchDefinition.combinations),
        ...addonAspects,
      ]),
    ].sort((a, b) => aspectLabel(a).localeCompare(aspectLabel(b))),
  }
}
