import {
  type GtnhCatalog,
  parseGtnhCatalog,
  parseGtnhManifest,
  parseItemTypes,
} from '@/features/essentia/dataset/gtnhDataset'
import { prepareGtnhCatalog } from '@/features/essentia/model/prepareGtnhCatalog'

self.onmessage = async (
  event: MessageEvent<{ dataBase: string; iconBase: string; expectedVersion: string }>,
) => {
  const { dataBase, iconBase, expectedVersion } = event.data
  const base = dataBase.replace(/\/+$/, '')
  try {
    const [manifestResponse, catalogResponse, typesResponse] = await Promise.all([
      fetch(`${base}/prepared/package-manifest.json`),
      fetch(`${base}/prepared/aspect-catalog.json.gz`),
      fetch(`${base}/raw/item-types-00001.jsonl.gz`),
    ])
    if (!manifestResponse.ok || !catalogResponse.ok || !typesResponse.ok)
      throw new Error('GTNH catalog is unavailable')

    const manifest = parseGtnhManifest(await manifestResponse.json())
    if (manifest.source.targetGtnhVersion !== expectedVersion)
      throw new Error('GTNH dataset version does not match the configured version')
    const [catalogData, itemTypesText] = await Promise.all([
      catalogResponse.json() as Promise<GtnhCatalog>,
      new Response(typesResponse.body?.pipeThrough(new DecompressionStream('gzip'))).text(),
    ])
    const catalog = parseGtnhCatalog(catalogData, manifest)
    const itemTypes = parseItemTypes(itemTypesText)
    self.postMessage({ type: 'ready', catalog: prepareGtnhCatalog(catalog, itemTypes, iconBase) })
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'GTNH catalog is unavailable',
    })
  }
}
