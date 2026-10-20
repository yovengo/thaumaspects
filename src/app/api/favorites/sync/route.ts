import type { NextRequest } from 'next/server'
import { itemKeysFromBody } from '@/server/favoriteInput'
import { mergeLocalItems } from '@/server/favorites'
import { bodyObject, currentUser, failure, json, requireMutation } from '@/server/http'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = requireMutation(request)
  if (denied) return denied
  const body = await bodyObject(request, 5_000_000)
  const items = itemKeysFromBody(body?.items)
  const unavailable = itemKeysFromBody(body?.unavailable ?? [])
  if (!items || !unavailable) return json({ error: 'Invalid items.' }, 400)
  try {
    const user = await currentUser()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    return json(await mergeLocalItems(user.id, items, unavailable))
  } catch (error) {
    return failure(error)
  }
}
