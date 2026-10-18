import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { rateKey, SESSION_COOKIE, sessionHash } from './auth'
import { query } from './db'

type User = { id: string }

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function failure(_error: unknown): NextResponse {
  void _error
  return json({ error: 'Service temporarily unavailable.' }, 503)
}

export function requireMutation(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin')
  const expected =
    process.env.APP_ORIGIN ||
    (process.env.NODE_ENV !== 'production' ? new URL(request.url).origin : '')
  if (!expected || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site')
    return json({ error: 'Request denied.' }, 403)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return json({ error: 'JSON required.' }, 415)
  return null
}

export async function bodyObject(
  request: NextRequest,
  maxLength = 65536,
): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get('content-length') || 0) > maxLength) return null
  try {
    const raw = await request.text()
    if (raw.length > maxLength) return null
    const value: unknown = JSON.parse(raw)
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const rows = await query<User>(
    `SELECT u.id FROM private.app_sessions s JOIN private.app_users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [sessionHash(token)],
  )
  return rows[0] ?? null
}

export async function currentUserWithCode(): Promise<
  (User & { code_encrypted: string | null }) | null
> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const rows = await query<User & { code_encrypted: string | null }>(
    `SELECT u.id,u.code_encrypted
    FROM private.app_sessions s JOIN private.app_users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [sessionHash(token)],
  )
  return rows[0] ?? null
}

export async function rateLimit(
  request: NextRequest,
  operation: 'register' | 'login' | 'rotate',
  code?: string,
  userId?: string,
): Promise<boolean> {
  const ip =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  const buckets: Array<[string, number, number]> =
    operation === 'register'
      ? [
          ['register:global', 100, 3600],
          [`register:ip:${rateKey(ip)}`, 3, 3600],
        ]
      : operation === 'login'
        ? [
            ['login:global', 300, 600],
            [`login:ip:${rateKey(ip)}`, 12, 600],
            [`login:code:${rateKey(code || 'invalid')}`, 6, 600],
          ]
        : [
            ['rotate:global', 100, 3600],
            [`rotate:user:${userId}`, 3, 86400],
          ]
  const rows = await query<{ bucket: string; hits: number }>(
    `INSERT INTO private.auth_rate_limits (bucket,hits,resets_at)
    SELECT input.bucket,1,now()+(input.seconds * interval '1 second')
    FROM unnest($1::text[],$2::int[]) AS input(bucket,seconds)
    ON CONFLICT (bucket) DO UPDATE SET
    hits=CASE WHEN private.auth_rate_limits.resets_at<=now() THEN 1 ELSE private.auth_rate_limits.hits+1 END,
    resets_at=CASE WHEN private.auth_rate_limits.resets_at<=now() THEN excluded.resets_at ELSE private.auth_rate_limits.resets_at END
    RETURNING bucket,hits`,
    [buckets.map(([bucket]) => bucket), buckets.map(([, , seconds]) => seconds)],
  )
  const limits = new Map(buckets.map(([bucket, limit]) => [bucket, limit]))
  return (
    rows.length === buckets.length &&
    rows.every(({ bucket, hits }) => hits <= (limits.get(bucket) ?? 0))
  )
}
