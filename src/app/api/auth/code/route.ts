import type { NextRequest } from 'next/server'
import { decryptCode, normalizeCode } from '@/server/auth'
import {
  bodyObject,
  currentUserWithCode,
  failure,
  json,
  rateLimit,
  requireMutation,
} from '@/server/http'
import { confirmLegacyCode } from '@/server/session'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await currentUserWithCode()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    return json({ code: user.code_encrypted ? decryptCode(user.code_encrypted, user.id) : null })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: NextRequest) {
  const denied = requireMutation(request)
  if (denied) return denied
  const body = await bodyObject(request)
  const code = normalizeCode(body?.code)
  try {
    const user = await currentUserWithCode()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    if (!(await rateLimit(request, 'login', code ?? 'invalid')))
      return json({ error: 'Too many attempts. Try again later.' }, 429)
    if (!code) return json({ error: 'Invalid access code.' }, 400)
    if (user.code_encrypted) return json({ code: decryptCode(user.code_encrypted, user.id) })
    if (!(await confirmLegacyCode(user.id, code)))
      return json({ error: 'Invalid access code.' }, 401)
    return json({ code: `${code.slice(0, 5)}-${code.slice(5)}` })
  } catch (error) {
    return failure(error)
  }
}
