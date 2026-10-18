import type { NextRequest } from 'next/server'
import { normalizeCode } from '@/server/auth'
import { bodyObject, failure, json, rateLimit, requireMutation } from '@/server/http'
import { openSessionForCode, setSessionCookie } from '@/server/session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = requireMutation(request)
  if (denied) return denied
  const body = await bodyObject(request)
  const code = normalizeCode(body?.code)
  try {
    if (!(await rateLimit(request, 'login', code ?? 'invalid')))
      return json({ error: 'Too many attempts. Try again later.' }, 429)
    if (!code) return json({ error: 'Invalid access code.' }, 401)
    const session = await openSessionForCode(code)
    if (!session) return json({ error: 'Invalid access code.' }, 401)
    const response = json({ user: { id: session.userId } })
    setSessionCookie(response, session.token)
    return response
  } catch (error) {
    return failure(error)
  }
}
