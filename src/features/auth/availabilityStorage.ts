import type { PendingFavoriteChanges } from '@/features/auth/favoriteSync'

export type Availability = { preferred: string[]; excluded: string[]; stage: string }
export type Pending = PendingFavoriteChanges

export const availabilityKey = 'thaumaspects:availability:v2'
export const availabilityEvent = 'thaumaspects:availability-changed'
const anonymousKey = 'thaumaspects:anonymous-availability:v1'
const anonymousAdditionsKey = 'thaumaspects:anonymous-added:v1'
const anonymousUnavailableAdditionsKey = 'thaumaspects:anonymous-unavailable-added:v1'
const accountKey = (id: string) => `thaumaspects:cloud:${id}:v1`
const unavailableAccountKey = (id: string) => `thaumaspects:cloud-unavailable:${id}:v1`
const pendingKey = (id: string) => `thaumaspects:pending:${id}:v1`
const unavailablePendingKey = (id: string) => `thaumaspects:pending-unavailable:${id}:v1`

export function readAvailability(): Availability {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(availabilityKey) || '{}',
    ) as Partial<Availability>
    return {
      preferred: Array.isArray(parsed.preferred)
        ? parsed.preferred.filter((item): item is string => typeof item === 'string')
        : [],
      excluded: Array.isArray(parsed.excluded)
        ? parsed.excluded.filter((item): item is string => typeof item === 'string')
        : [],
      stage: typeof parsed.stage === 'string' ? parsed.stage : 'NONE',
    }
  } catch {
    return { preferred: [], excluded: [], stage: 'NONE' }
  }
}

export function writeAvailability(preferred: string[], excluded: string[]) {
  const current = readAvailability()
  if (
    current.preferred.length === preferred.length &&
    current.preferred.every((item, index) => item === preferred[index]) &&
    current.excluded.length === excluded.length &&
    current.excluded.every((item, index) => item === excluded[index])
  )
    return
  localStorage.setItem(availabilityKey, JSON.stringify({ ...current, preferred, excluded }))
  window.dispatchEvent(new Event(availabilityEvent))
}

export function readPending(id: string, unavailable = false): Pending {
  try {
    const key = unavailable ? unavailablePendingKey(id) : pendingKey(id)
    const value = JSON.parse(localStorage.getItem(key) || '{}') as Pending
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, 'add' | 'remove'] =>
          (entry[1] === 'add' || entry[1] === 'remove') &&
          entry[0].length > 0 &&
          entry[0].length <= 2000,
      ),
    )
  } catch {
    return {}
  }
}

export function writePending(id: string, changes: Pending, unavailable = false) {
  localStorage.setItem(
    unavailable ? unavailablePendingKey(id) : pendingKey(id),
    JSON.stringify(changes),
  )
}

export function mergePending(id: string, changes: Pending, unavailable = false) {
  if (Object.keys(changes).length)
    writePending(id, { ...readPending(id, unavailable), ...changes }, unavailable)
}

export function readAnonymousAdditions(unavailable = false): string[] {
  try {
    const key = unavailable ? anonymousUnavailableAdditionsKey : anonymousAdditionsKey
    const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(stored)
      ? stored.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export function updateAnonymousAdditions(changes: Pending, unavailable = false) {
  if (!Object.keys(changes).length) return
  const next = new Set(readAnonymousAdditions(unavailable))
  for (const [item, action] of Object.entries(changes)) {
    if (action === 'add') next.add(item)
    else next.delete(item)
  }
  localStorage.setItem(
    unavailable ? anonymousUnavailableAdditionsKey : anonymousAdditionsKey,
    JSON.stringify([...next]),
  )
}

export function clearAnonymousAdditions() {
  localStorage.removeItem(anonymousAdditionsKey)
  localStorage.removeItem(anonymousUnavailableAdditionsKey)
}

export function accountNeedsSync(id: string) {
  return {
    favorites: !localStorage.getItem(accountKey(id)),
    unavailable: !localStorage.getItem(unavailableAccountKey(id)),
  }
}

export function markAccountSynced(id: string) {
  localStorage.setItem(accountKey(id), '1')
  localStorage.setItem(unavailableAccountKey(id), '1')
}

export function rememberAnonymousAvailability() {
  if (!localStorage.getItem(anonymousKey))
    localStorage.setItem(anonymousKey, JSON.stringify(readAvailability()))
}

export function restoreAnonymousAvailability() {
  const anonymous = localStorage.getItem(anonymousKey)
  if (anonymous) {
    localStorage.setItem(availabilityKey, anonymous)
    window.dispatchEvent(new Event(availabilityEvent))
    localStorage.removeItem(anonymousKey)
  } else {
    writeAvailability([], [])
  }
}
