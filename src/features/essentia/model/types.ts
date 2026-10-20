import type {
  ItemAspect,
  Plan,
  PlanLine,
  Requirement,
} from '@/features/essentia/model/plannerTypes'

export type UnprofiledItem = { name: string; registryId: string }

export type Catalog = {
  aspects: string[]
  items: ItemAspect[]
  unprofiledItems?: UnprofiledItem[]
  aspectSource?: { version: string; count: number; fallbackCounts?: Record<string, number> }
  iconSource?: { counts: Record<string, number> }
  acquisitionSource?: { version: string; recipeCount: number }
}

export type Row = { id: number; aspect: string; amount: string }
export type CatalogFilter = 'allSelected' | 'anySelected' | 'allItems'
export type CatalogSort = 'practical' | 'quantity' | 'name'
export type Availability = { preferred: string[]; excluded: string[]; stage: string }

export type PlannerSession = {
  rows: Row[]
  nextId: number
  selectedId: string | null
  customLines: PlanLine[]
  catalogFilter: CatalogFilter
  catalogSort: CatalogSort
  query: string
  sourceQuery: string
  sourcePickerOpen: boolean
  sourceVisibleCount: number
  visibleCount: number
  catalogOpen: boolean
  sourcesOpen: boolean
  sourcesFilter: 'favorite' | 'excluded'
  sourcesQuery: string
  sourcesVisibleCount: number
  alternativesOpen: boolean
  expandedItems: string[]
}

export type PlanJob = {
  type: 'calculate'
  request: string
  required: Requirement
  preferences: Availability
}
export type PlanResult = { request: string; plans: Plan[]; error?: boolean; partial?: boolean }
export type IndexResult = { request: string; indices: number[] }
export type WorkerResult =
  | ({ type: 'calculate' } & PlanResult)
  | ({ type: 'catalog' | 'sources' } & IndexResult)
