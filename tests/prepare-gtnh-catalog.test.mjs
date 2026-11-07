import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { migratePreferences } from '../src/features/essentia/dataset/migratePreferences.ts'
import { key } from '../src/features/essentia/model/itemRanking.ts'
import { prepareGtnhCatalog } from '../src/features/essentia/model/prepareGtnhCatalog.ts'

const observed = {
  source: { targetGtnhVersion: '2.9.0' },
  aspects: ['ignis', 'potentia'],
  items: [
    {
      id: 'minecraft:coal@0',
      registryName: 'minecraft:coal',
      name: 'Coal',
      aspects: { ignis: 2, potentia: 2, terra: 0 },
      iconPath: `icons/${'a'.repeat(64)}.png`,
      iconStatus: 'rendered',
    },
  ],
}

test('the prepared catalog retains the source version and exact icons', () => {
  const catalog = prepareGtnhCatalog(
    observed,
    new Map([['minecraft:coal', 'net.minecraft.item.ItemCoal']]),
    'https://example.com/snapshot/',
  )
  assert.equal(catalog.items.length, 1)
  assert.deepEqual(catalog.items[0].aspects, { ignis: 2, potentia: 2 })
  assert.equal(catalog.items[0].sourceClass, 'net.minecraft.item.ItemCoal')
  assert.equal(
    catalog.items[0].iconUrl,
    `https://example.com/snapshot/raw/icons/${'a'.repeat(64)}.png`,
  )
  assert.equal(catalog.aspectSource.version, '2.9.0')
})

test('the prepared catalog uses the version from its source', () => {
  const catalog = prepareGtnhCatalog(
    { ...observed, source: { targetGtnhVersion: '2.10.0' } },
    new Map(),
    'https://example.com/snapshot/',
  )
  assert.equal(catalog.aspectSource.version, '2.10.0')
})

test('old favorites and exclusions migrate to stable variant keys once', () => {
  const items = prepareGtnhCatalog(observed, new Map(), 'https://example.com').items
  const old = 'minecraft:coal@0|ignis:2,potentia:2'
  const availability = { preferred: [old], excluded: [old], stage: 'NONE' }
  const migrated = migratePreferences(availability, items)
  assert.deepEqual(migrated.preferred, [key(items[0])])
  assert.deepEqual(migrated.excluded, [key(items[0])])
  assert.deepEqual(migratePreferences(migrated, items), migrated)
})

test('changed legacy aspect profiles keep their saved preference', () => {
  const aliases = JSON.parse(
    readFileSync(
      new URL('../src/features/essentia/dataset/legacyPreferenceAliases.json', import.meta.url),
      'utf8',
    ),
  )
  const [oldKey, newId] = Object.entries(aliases)[0]
  const migrated = migratePreferences({ preferred: [oldKey], excluded: [], stage: 'NONE' }, [
    { name: 'Legacy item', registryId: newId, aspects: { ignis: 1 } },
  ])
  assert.deepEqual(migrated.preferred, [`gtnh:item:${newId}`])
})

test('versioned preferences migrate by item ID and retain unmatched entries', () => {
  const items = prepareGtnhCatalog(observed, new Map(), 'https://example.com').items
  const saved = {
    preferred: ['gtnh:2.9.0:minecraft:coal@0', 'gtnh:2.8.0:missing:item@0'],
    excluded: [],
    stage: 'NONE',
  }
  const migrated = migratePreferences(saved, items)
  assert.deepEqual(migrated.preferred, [key(items[0]), 'gtnh:2.8.0:missing:item@0'])
})
