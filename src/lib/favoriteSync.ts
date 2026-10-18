export type PendingFavoriteChanges = Record<string, 'add' | 'remove'>

export function favoriteChanges(before: string[], after: string[]): PendingFavoriteChanges {
  const old = new Set(before)
  const next = new Set(after)
  const changes: PendingFavoriteChanges = {}
  for (const item of old) if (!next.has(item)) changes[item] = 'remove'
  for (const item of next) if (!old.has(item)) changes[item] = 'add'
  return changes
}

export function applyPendingFavorites(items: string[], pending: PendingFavoriteChanges): string[] {
  const result = new Set(items)
  for (const [item, action] of Object.entries(pending)) {
    if (action === 'add') result.add(item)
    else result.delete(item)
  }
  return [...result]
}

export function remainingFavoriteChanges(
  current: PendingFavoriteChanges,
  applied: PendingFavoriteChanges,
): PendingFavoriteChanges {
  return Object.fromEntries(
    Object.entries(current).filter(([item, action]) => applied[item] !== action),
  )
}
