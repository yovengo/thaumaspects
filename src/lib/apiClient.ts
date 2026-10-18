export async function api<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(payload ?? {}),
  })
  const data = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}
