export type ItemIconData =
  | { kind: 'atlas'; id: number; quality: 'exact' | 'ambiguous' | 'related' | 'generic' }
  | { kind: 'rendered'; file: string; quality: 'exact' | 'ambiguous' }
export type ItemAspect = {
  name: string
  aspects: Record<string, number>
  icon?: ItemIconData
  registryId?: string
  aspectVersion?: string
  acquisition?: Record<string, [number, number]>
}
export type Requirement = Record<string, number>
export type PlanLine = { item: ItemAspect; count: number }
export type Plan = {
  id: string
  title: string
  lines: PlanLine[]
  produced: Requirement
  remaining: Requirement
  itemCount: number
  extra: number
}
export type PlannerPreferences = {
  preferred?: ReadonlySet<string>
  excluded?: ReadonlySet<string>
  stage?: string
}
