import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildPlans, key, prepareItems } from '../src/features/essentia/model/planner.ts'

const profiles = JSON.parse(
  readFileSync(new URL('./fixtures/gtnh-2.9.0-sample.json', import.meta.url), 'utf8'),
)
const items = prepareItems(
  profiles.map((profile) => ({
    name: profile.name,
    registryId: profile.id,
    aspects: profile.aspects,
    sourceClass: profile.sourceClass,
  })),
)

function checkCoverage(plans, required) {
  assert.ok(plans.length > 0)
  for (const plan of plans)
    for (const [aspect, amount] of Object.entries(required))
      assert.ok((plan.produced[aspect] ?? 0) >= amount, `${plan.title} is missing ${aspect}`)
}

test('new GTNH profiles produce a practical multi-aspect mix', () => {
  const two = { ignis: 16, potentia: 16 }
  const twoPlans = buildPlans(items, two)
  checkCoverage(twoPlans, two)
  assert.deepEqual(
    twoPlans[0].lines.map(({ item, count }) => [item.name, count]),
    [['Coal', 8]],
  )

  const three = { ...two, terra: 16 }
  const threePlans = buildPlans(items, three)
  checkCoverage(threePlans, three)
  assert.deepEqual(
    threePlans[0].lines.map(({ item, count }) => [item.name, count]),
    [
      ['Coal', 8],
      ['Dirt', 8],
    ],
  )
})

test('the item-type estimate avoids rare high-aspect sources', () => {
  const aer = buildPlans(items, { aer: 18 })
  checkCoverage(aer, { aer: 18 })
  assert.equal(aer[0].lines[0].item.name, 'Sugar Canes')

  const instrumentum = buildPlans(items, { instrumentum: 32 })
  checkCoverage(instrumentum, { instrumentum: 32 })
  assert.equal(instrumentum[0].lines[0].item.name, 'Flint')
})

test('favorite and unavailable keys use the stable GTNH variant ID', () => {
  const coal = items.find((item) => item.registryId === 'minecraft:coal@0')
  const charcoal = items.find((item) => item.registryId === 'minecraft:coal@1')
  assert.ok(coal && charcoal)
  assert.notEqual(key(coal), key(charcoal))
  const required = { ignis: 16, potentia: 16 }
  const favorite = buildPlans(items, required, { preferred: new Set([key(charcoal)]) })
  assert.equal(favorite[0].lines[0].item.name, 'Charcoal')
  const excluded = buildPlans(items, required, { excluded: new Set([key(coal)]) })
  assert.ok(excluded[0].lines.every(({ item }) => key(item) !== key(coal)))
})

test('the practical plan prefers favorites and avoids byproducts between favorite sources', () => {
  const stone = {
    name: 'Stone',
    registryId: 'minecraft:stone@0',
    aspects: { terra: 2 },
    sourceClass: 'net.minecraft.item.ItemBlock',
  }
  const clay = {
    name: 'Clay',
    registryId: 'minecraft:clay_ball@0',
    aspects: { terra: 1, aqua: 1 },
    sourceClass: 'net.minecraft.item.Item',
  }
  const dirt = {
    name: 'Dirt',
    registryId: 'minecraft:dirt@0',
    aspects: { terra: 2 },
    sourceClass: 'net.minecraft.item.ItemMultiTexture',
  }
  const required = { terra: 16 }
  const preferred = new Set([key(stone), key(clay)])
  const plans = buildPlans([stone, clay, dirt], required, { preferred })
  assert.deepEqual(
    plans[0].lines.map(({ item, count }) => [item.name, count]),
    [['Stone', 8]],
  )
  assert.equal(plans[0].extra, 0)

  const clayOnly = buildPlans([stone, clay, dirt], required, {
    preferred: new Set([key(clay)]),
  })
  assert.equal(clayOnly[0].lines[0].item.name, 'Clay')

  const excludedFavorite = buildPlans([stone, clay, dirt], required, {
    preferred,
    excluded: new Set([key(stone)]),
  })
  assert.equal(excludedFavorite[0].lines[0].item.name, 'Clay')
})
