export function itemKeyFromBody(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 2000 ? value : null
}

export function itemKeysFromBody(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 2000) return null
  const keys: string[] = []
  for (const item of value) {
    const key = itemKeyFromBody(item)
    if (!key) return null
    keys.push(key)
  }
  return [...new Set(keys)]
}
