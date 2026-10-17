import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildPlans, key, prepareItems } from '../src/lib/essentiaPlanner.ts'

const catalog = JSON.parse(readFileSync(new URL('../public/item-aspects-gtnh.json', import.meta.url), 'utf8'))
const items = prepareItems(catalog.items)

function checkCoverage(plans, required) {
  assert.ok(plans.length > 0)
  for (const plan of plans) {
    for (const [aspect, amount] of Object.entries(required)) {
      assert.ok((plan.produced[aspect] ?? 0) >= amount, `${plan.title} is missing ${aspect}`)
    }
  }
}

test('planner combines sources for independent aspects and keeps alternatives valid', () => {
  const two = { ignis: 16, potentia: 16 }
  const twoPlans = buildPlans(items, two, { stage: 'NONE' })
  checkCoverage(twoPlans, two)
  assert.deepEqual(twoPlans[0].lines.map(({ item, count }) => [item.name, count]), [['Coal', 8]])

  const three = { ...two, terra: 16 }
  const threePlans = buildPlans(items, three, { stage: 'NONE' })
  checkCoverage(threePlans, three)
  assert.ok(threePlans[0].lines.length > 1)
})

test('planner still chooses accessible Aer sources and covers Instrumentum', () => {
  const aer = { aer: 18 }
  const aerPlans = buildPlans(items, aer, { stage: 'NONE' })
  checkCoverage(aerPlans, aer)
  assert.equal(aerPlans[0].lines[0].item.name, 'Sugar Canes')

  const instrumentum = { instrumentum: 32 }
  checkCoverage(buildPlans(items, instrumentum, { stage: 'LV' }), instrumentum)
})

test('favorite-only preview remains a valid option after the full search', () => {
  const charcoal = items.find((item) => item.registryId === 'minecraft:coal@1')
  assert.ok(charcoal)
  const required = { ignis: 16, potentia: 16 }
  const preferences = { stage: 'NONE', preferred: new Set([key(charcoal)]) }
  const favoritePlan = buildPlans([charcoal], required, preferences)[0]
  checkCoverage([favoritePlan], required)
  const plans = buildPlans(items, required, preferences, favoritePlan)
  checkCoverage(plans, required)
  assert.ok(plans.some((plan) => plan.id === favoritePlan.id))
})

test('practical multi-aspect mix survives beam limits and uses simple preferred sources', () => {
  const required = { potentia: 40, motus: 80, volatus: 16 }
  const coal = items.find((item) => item.registryId === 'minecraft:coal')
  const redstone = items.find((item) => item.registryId === 'minecraft:redstone')
  assert.ok(coal && redstone)
  const preferences = { stage: 'NONE', preferred: new Set([key(coal), key(redstone)]) }
  const plans = buildPlans(items, required, preferences)
  checkCoverage(plans, required)
  assert.equal(plans[0].title, 'Practical items')
  assert.ok(plans[0].lines.some(({ item, count }) => item.registryId === 'minecraft:redstone' && count === 20))
  assert.ok(plans[0].lines.every(({ item }) => !['minecraft:coal_block', 'minecraft:quartz'].includes(item.registryId)))
})
