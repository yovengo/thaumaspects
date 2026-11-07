export type ItemIconData = { kind: 'remote'; url: string; quality: 'exact' }
export type ItemAspect = {
  name: string
  aspects: Record<string, number>
  icon?: ItemIconData
  registryId?: string
  sourceClass?: string
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
