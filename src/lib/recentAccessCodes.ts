export type RecentAccessCode = { userId: string; code: string }

const storageKey = 'thaumaspects:recent-access-codes:v1'
const codePattern = /^\d{5}-\d{5}$/

export function parseRecentAccessCodes(value: unknown): RecentAccessCode[] {
  if (!Array.isArray(value)) return []
  const seenUsers = new Set<string>()
  const seenCodes = new Set<string>()
  const entries: RecentAccessCode[] = []
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.userId !== 'string' ||
      !entry.userId ||
      typeof entry.code !== 'string' ||
      !codePattern.test(entry.code) ||
      seenUsers.has(entry.userId) ||
      seenCodes.has(entry.code)
    )
      continue
    seenUsers.add(entry.userId)
    seenCodes.add(entry.code)
    entries.push({ userId: entry.userId, code: entry.code })
    if (entries.length === 3) break
  }
  return entries
}

export function addRecentAccessCode(
  entries: RecentAccessCode[],
  userId: string,
  code: string,
): RecentAccessCode[] {
  if (!userId || !codePattern.test(code)) return entries
  return [
    { userId, code },
    ...entries.filter((entry) => entry.userId !== userId && entry.code !== code),
  ].slice(0, 3)
}

export function readRecentAccessCodes(): RecentAccessCode[] {
  try {
    return parseRecentAccessCodes(JSON.parse(localStorage.getItem(storageKey) || '[]'))
  } catch {
    return []
  }
}

function writeRecentAccessCodes(entries: RecentAccessCode[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries))
  } catch {
    // Authentication still works when browser storage is unavailable.
  }
  return entries
}

export function rememberRecentAccessCode(userId: string, code: string): RecentAccessCode[] {
  return writeRecentAccessCodes(addRecentAccessCode(readRecentAccessCodes(), userId, code))
}

export function forgetRecentAccessCode(code: string): RecentAccessCode[] {
  return writeRecentAccessCodes(readRecentAccessCodes().filter((entry) => entry.code !== code))
}
