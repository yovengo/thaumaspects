import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPendingFavorites,
  favoriteChanges,
  remainingFavoriteChanges,
} from '../src/lib/favoriteSync.ts'
import {
  codeHash,
  createSessionToken,
  decryptCode,
  encryptCode,
  generateCode,
  normalizeCode,
  sessionHash,
} from '../src/server/auth.ts'

test('access codes have exactly ten digits and normalize both accepted forms', () => {
  for (let i = 0; i < 100; i++) {
    const code = generateCode()
    assert.match(code, /^\d{5}-\d{5}$/)
    assert.equal(normalizeCode(code), code.replace('-', ''))
  }
  assert.equal(normalizeCode('1234567890'), '1234567890')
  assert.equal(normalizeCode('1234-567890'), null)
})

test('codes are hashed for lookup and encrypted for signed-in retrieval', () => {
  process.env.AUTH_CODE_SECRET = 'a-secret-with-at-least-thirty-two-characters'
  const code = '1234567890'
  const digest = codeHash(code)
  assert.match(digest, /^[0-9a-f]{64}$/)
  assert.notEqual(digest, code)
  assert.notEqual(digest, codeHash('1234567891'))
  const userId = '550e8400-e29b-41d4-a716-446655440000'
  const encrypted = encryptCode('12345-67890', userId)
  assert.doesNotMatch(encrypted, /12345/)
  assert.equal(decryptCode(encrypted, userId), '12345-67890')
  assert.notEqual(encryptCode('12345-67890', userId), encrypted)
  assert.throws(() => decryptCode(encrypted, '550e8400-e29b-41d4-a716-446655440001'))
  const parts = encrypted.split('.')
  parts[2] = parts[2][0] === 'A' ? `B${parts[2].slice(1)}` : `A${parts[2].slice(1)}`
  assert.throws(() => decryptCode(parts.join('.'), userId))
  const token = createSessionToken()
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  assert.match(sessionHash(token), /^[0-9a-f]{64}$/)
  assert.notEqual(sessionHash(token), token)
})

test('remote deletion wins over unchanged stale local favorites', () => {
  const staleLocal = ['coal', 'redstone']
  const pending = favoriteChanges(staleLocal, staleLocal)
  assert.deepEqual(applyPendingFavorites(['coal'], pending), ['coal'])
})

test('offline local edits survive the next remote pull', () => {
  const pending = favoriteChanges(['coal', 'redstone'], ['redstone', 'sugar-cane'])
  assert.deepEqual(pending, { coal: 'remove', 'sugar-cane': 'add' })
  assert.deepEqual(applyPendingFavorites(['coal', 'redstone', 'quartz'], pending), [
    'redstone',
    'quartz',
    'sugar-cane',
  ])
})

test('a new favorite edit during sync remains queued', () => {
  const sent = { coal: 'add', quartz: 'remove' }
  const current = { coal: 'remove', quartz: 'remove', iron: 'add' }
  assert.deepEqual(remainingFavoriteChanges(current, sent), { coal: 'remove', iron: 'add' })
})
