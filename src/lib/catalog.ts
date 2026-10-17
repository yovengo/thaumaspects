import { addonDictionary } from '../data/addons.js'
import { translate } from '../data/aspects.js'
import { versionDictionary } from '../data/versions.js'
import type { AddonDefinition, Catalog, VersionDefinition } from '../types/domain'

export const aspectNames = translate as Record<string, string>
export const versionMap = versionDictionary as unknown as Record<string, VersionDefinition>
export const addonMap = addonDictionary as unknown as Record<string, AddonDefinition>
export const versions = Object.keys(versionMap)
// GTNH uses Thaumcraft 4. This is the newest TC4 research graph in our source data.
export const gtnhResearchVersion = '4.2.2.0'
export const versionStorageKey = 'thaumaspects.version'
export const addonEntries = Object.entries(addonMap)

export const aspectLabel = (aspect: string) => `${aspectNames[aspect] ?? aspect}`.replace(/^./, (letter) => letter.toUpperCase())

export const aspectIconUrl = (aspect: string, muted = false) => `/aspects/${muted ? 'mono' : 'color'}/${aspectNames[aspect]}.png`

export function getStoredVersion() {
  if (typeof window === 'undefined') return gtnhResearchVersion
  const storedVersion = window.localStorage.getItem(versionStorageKey)
  return storedVersion && storedVersion in versionMap ? storedVersion : gtnhResearchVersion
}

export function getCatalog(version: string): Catalog {
  const definition = versionMap[version]
  const combinations = { ...definition.combinations }
  const addonAspects: string[] = []

  addonEntries.forEach(([, addon]) => {
    Object.assign(combinations, addon.combinations)
    addonAspects.push(...addon.aspects)
  })

  return {
    combinations,
    addonAspects,
    aspects: [...new Set([...definition.base_aspects, ...Object.keys(definition.combinations), ...addonAspects])]
      .sort((a, b) => aspectLabel(a).localeCompare(aspectLabel(b))),
  }
}

export const defaultEnabled = (catalog: Catalog) => new Set(catalog.aspects)
