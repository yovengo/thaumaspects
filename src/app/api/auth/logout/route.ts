import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, sessionHash } from '@/server/auth'
import { query } from '@/server/db'
import { failure, json, requireMutation } from '@/server/http'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = requireMutation(request)
  if (denied) return denied
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    if (token)
      await query('DELETE FROM private.app_sessions WHERE token_hash=$1', [sessionHash(token)])
    const response = json({ ok: true })
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (error) {
    return failure(error)
  }
}
