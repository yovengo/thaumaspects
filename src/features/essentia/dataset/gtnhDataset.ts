export type GtnhItemProfile = {
  id: string
  name: string
  registryName: string
  metadata: number
  aspects: Record<string, number>
  iconPath: string | null
  iconStatus: 'rendered' | 'cached' | 'empty' | 'error'
  smeltability: string
}

export type GtnhCatalog = {
  schemaVersion: '1.0.0'
  source: { runId: string; targetGtnhVersion: string; identityVersion: 1 }
  aspects: string[]
  items: GtnhItemProfile[]
}

export type GtnhManifest = {
  schemaVersion: '1.0.0'
  catalogItems: number
  source: GtnhCatalog['source']
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonnegativeAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

function validateSource(value: unknown): value is GtnhCatalog['source'] {
  return (
    isRecord(value) &&
    typeof value.runId === 'string' &&
    value.runId.length > 0 &&
    typeof value.targetGtnhVersion === 'string' &&
    value.targetGtnhVersion.length > 0 &&
    value.identityVersion === 1
  )
}

function isItemProfile(value: unknown): value is GtnhItemProfile {
  if (!isRecord(value) || !isRecord(value.aspects)) return false

  const amounts = Object.values(value.aspects)
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    typeof value.registryName === 'string' &&
    typeof value.metadata === 'number' &&
    Number.isSafeInteger(value.metadata) &&
    amounts.some((amount) => typeof amount === 'number' && amount > 0) &&
    amounts.every(isNonnegativeAmount) &&
    (value.iconPath === null || typeof value.iconPath === 'string') &&
    ['rendered', 'cached', 'empty', 'error'].includes(String(value.iconStatus)) &&
    typeof value.smeltability === 'string'
  )
}

export function parseGtnhManifest(value: unknown): GtnhManifest {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1.0.0' ||
    !validateSource(value.source) ||
    !isPositiveInteger(value.catalogItems)
  ) {
    throw new Error('Unsupported GTNH dataset manifest')
  }
  return value as GtnhManifest
}

export function parseGtnhCatalog(value: unknown, manifest: GtnhManifest): GtnhCatalog {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1.0.0' ||
    !validateSource(value.source) ||
    value.source.runId !== manifest.source.runId ||
    value.source.targetGtnhVersion !== manifest.source.targetGtnhVersion ||
    !Array.isArray(value.aspects) ||
    !value.aspects.every((aspect) => typeof aspect === 'string') ||
    !Array.isArray(value.items) ||
    value.items.length !== manifest.catalogItems
  ) {
    throw new Error('GTNH dataset is incomplete or has an unsupported format')
  }

  const ids = new Set<string>()
  for (const item of value.items) {
    if (!isItemProfile(item) || ids.has(item.id)) {
      throw new Error('GTNH dataset contains an invalid item profile')
    }
    ids.add(item.id)
  }
  return value as GtnhCatalog
}

export function gtnhIconUrl(baseUrl: string, item: GtnhItemProfile): string | null {
  if (
    !['rendered', 'cached'].includes(item.iconStatus) ||
    !item.iconPath ||
    !/^icons\/[a-f0-9]{64}\.png$/.test(item.iconPath)
  ) {
    return null
  }
  return `${baseUrl.replace(/\/+$/, '')}/raw/${item.iconPath}`
}

export function parseItemTypes(text: string): Map<string, string> {
  const types = new Map<string, string>()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const row: unknown = JSON.parse(line)
    if (!isRecord(row) || typeof row.registryName !== 'string' || typeof row.className !== 'string')
      throw new Error('GTNH item types are invalid')
    types.set(row.registryName, row.className)
  }
  return types
}
