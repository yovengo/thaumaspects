import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addRecentAccessCode,
  forgetRecentAccessCode,
  parseRecentAccessCodes,
  readRecentAccessCodes,
  rememberRecentAccessCode,
} from '../src/lib/recentAccessCodes.ts'

test('recent access codes keep three unique accounts in most recent order', () => {
  let entries = []
  for (const [userId, code] of [
    ['a', '11111-11111'],
    ['b', '22222-22222'],
    ['c', '33333-33333'],
    ['d', '44444-44444'],
    ['b', '22222-22222'],
  ]) {
    entries = addRecentAccessCode(entries, userId, code)
  }
  assert.deepEqual(entries, [
    { userId: 'b', code: '22222-22222' },
    { userId: 'd', code: '44444-44444' },
    { userId: 'c', code: '33333-33333' },
  ])
  assert.deepEqual(addRecentAccessCode(entries, 'b', '55555-55555')[0], {
    userId: 'b',
    code: '55555-55555',
  })
})

test('stored codes reject malformed entries and duplicates', () => {
  assert.deepEqual(
    parseRecentAccessCodes([
      null,
      { userId: 'a', code: '11111-11111' },
      { userId: 'a', code: '99999-99999' },
      { userId: 'b', code: '11111-11111' },
      { userId: 'b', code: '22222-22222' },
      { userId: 'c', code: 'bad' },
    ]),
    [
      { userId: 'a', code: '11111-11111' },
      { userId: 'b', code: '22222-22222' },
    ],
  )
})

test('recent codes persist locally and can be forgotten', () => {
  const originalStorage = globalThis.localStorage
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  try {
    rememberRecentAccessCode('a', '11111-11111')
    rememberRecentAccessCode('b', '22222-22222')
    assert.deepEqual(
      readRecentAccessCodes().map((entry) => entry.userId),
      ['b', 'a'],
    )
    forgetRecentAccessCode('22222-22222')
    assert.deepEqual(readRecentAccessCodes(), [{ userId: 'a', code: '11111-11111' }])
  } finally {
    globalThis.localStorage = originalStorage
  }
})
