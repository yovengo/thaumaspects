import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  gtnhIconUrl,
  parseGtnhCatalog,
  parseGtnhManifest,
} from '../src/features/essentia/dataset/gtnhDataset.ts'

const source = { runId: 'sample-run', targetGtnhVersion: '2.9.0', identityVersion: 1 }
const iconPath = `icons/${'a'.repeat(64)}.png`
const first = {
  id: 'mod:item@0',
  name: 'Same name',
  registryName: 'mod:item',
  metadata: 0,
  aspects: { ignis: 1 },
  iconPath,
  iconStatus: 'rendered',
  smeltability: 'unknown',
}
const second = { ...first, id: 'mod:item@1', metadata: 1, iconPath: null, iconStatus: 'empty' }
const manifest = parseGtnhManifest({ schemaVersion: '1.0.0', source, catalogItems: 2 })

test('GTNH catalog retains exact variants with the same display name', () => {
  const catalog = parseGtnhCatalog(
    { schemaVersion: '1.0.0', source, aspects: ['ignis'], items: [first, second] },
    manifest,
  )
  assert.deepEqual(
    catalog.items.map((item) => item.id),
    ['mod:item@0', 'mod:item@1'],
  )
  assert.equal(
    gtnhIconUrl('https://example.com/snapshot/', catalog.items[0]),
    `https://example.com/snapshot/raw/${iconPath}`,
  )
  assert.equal(gtnhIconUrl('https://example.com/snapshot/', catalog.items[1]), null)
})

test('GTNH catalog accepts zero entries in an otherwise positive aspect profile', () => {
  const catalog = parseGtnhCatalog(
    {
      schemaVersion: '1.0.0',
      source,
      aspects: ['ignis', 'terra'],
      items: [{ ...first, aspects: { ignis: 1, terra: 0 } }, second],
    },
    manifest,
  )
  assert.equal(catalog.items[0].aspects.terra, 0)
})

test('GTNH catalog rejects mismatched snapshots and malformed icon paths', () => {
  assert.throws(() =>
    parseGtnhCatalog(
      {
        schemaVersion: '1.0.0',
        source: { ...source, runId: 'other' },
        aspects: ['ignis'],
        items: [first, second],
      },
      manifest,
    ),
  )
  assert.throws(() =>
    parseGtnhCatalog(
      {
        schemaVersion: '1.0.0',
        source,
        aspects: ['ignis'],
        items: [first, { ...second, id: first.id }],
      },
      manifest,
    ),
  )
  assert.equal(gtnhIconUrl('https://example.com', { ...first, iconPath: '../secret.png' }), null)
})
