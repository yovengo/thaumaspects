import type { NextRequest } from 'next/server'
import { failure, json, rateLimit, requireMutation } from '@/server/http'
import { createAccount, setSessionCookie } from '@/server/session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = requireMutation(request)
  if (denied) return denied
  try {
    if (!(await rateLimit(request, 'register')))
      return json({ error: 'Too many attempts. Try again later.' }, 429)
    const { userId, code, token } = await createAccount()
    const response = json({ user: { id: userId }, code }, 201)
    setSessionCookie(response, token)
    return response
  } catch (error) {
    return failure(error)
  }
}
