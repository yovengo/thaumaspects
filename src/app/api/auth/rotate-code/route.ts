import type { NextRequest } from 'next/server'
import { currentUser, failure, json, rateLimit, requireMutation } from '@/server/http'
import { rotateAccountCode } from '@/server/session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = requireMutation(request)
  if (denied) return denied
  try {
    const user = await currentUser()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    if (!(await rateLimit(request, 'rotate', undefined, user.id)))
      return json({ error: 'Too many attempts. Try again later.' }, 429)
    return json({ code: await rotateAccountCode(user.id) })
  } catch (error) {
    return failure(error)
  }
}
