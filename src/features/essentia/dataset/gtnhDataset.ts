export const GTNH_DATASET_BASE_URL =
  process.env.NEXT_PUBLIC_GT_DATASET_BASE_URL?.trim() ||
  'https://pub-9e5f1e92c9c34b2f8e16025b7fee2c1c.r2.dev/gtnh/2.9.0/20261107-050238-8e0e20e6/'

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
  source: { runId: string; targetGtnhVersion: '2.9.0'; identityVersion: 1 }
  aspects: string[]
  items: GtnhItemProfile[]
}

export type GtnhManifest = {
  schemaVersion: '1.0.0'
  catalogItems: number
  source: { runId: string; targetGtnhVersion: '2.9.0'; identityVersion: 1 }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function validateSource(value: unknown): value is GtnhCatalog['source'] {
  return (
    isRecord(value) &&
    typeof value.runId === 'string' &&
    value.runId.length > 0 &&
    value.targetGtnhVersion === '2.9.0' &&
    value.identityVersion === 1
  )
}

export function parseGtnhManifest(value: unknown): GtnhManifest {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1.0.0' ||
    !validateSource(value.source) ||
    !Number.isSafeInteger(value.catalogItems) ||
    (value.catalogItems as number) <= 0
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
    !Array.isArray(value.aspects) ||
    !value.aspects.every((aspect) => typeof aspect === 'string') ||
    !Array.isArray(value.items) ||
    value.items.length !== manifest.catalogItems
  ) {
    throw new Error('GTNH dataset is incomplete or has an unsupported format')
  }

  const ids = new Set<string>()
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.name !== 'string' ||
      typeof item.registryName !== 'string' ||
      !Number.isSafeInteger(item.metadata) ||
      !isRecord(item.aspects) ||
      !Object.values(item.aspects).some((amount) => typeof amount === 'number' && amount > 0) ||
      !Object.values(item.aspects).every(
        (amount) => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0,
      ) ||
      (item.iconPath !== null && typeof item.iconPath !== 'string') ||
      !['rendered', 'cached', 'empty', 'error'].includes(String(item.iconStatus)) ||
      typeof item.smeltability !== 'string'
    ) {
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
