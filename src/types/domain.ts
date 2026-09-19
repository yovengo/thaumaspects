export type Combinations = Record<string, [string, string]>

export type VersionDefinition = {
  base_aspects: string[]
  combinations: Combinations
}

export type AddonDefinition = {
  name: string
  aspects: string[]
  combinations: Combinations
}

export type Catalog = {
  aspects: string[]
  addonAspects: string[]
  combinations: Combinations
}

export type Mode = 'quick' | 'board'
