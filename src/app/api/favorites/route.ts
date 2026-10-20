import type { NextRequest } from 'next/server'
import { itemChangesFromBody, itemKeyFromBody } from '@/server/favoriteInput'
import { applyItemChanges, getItems, setFavorite } from '@/server/favorites'
import { bodyObject, currentUser, failure, json, requireMutation } from '@/server/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    return json(await getItems(user.id))
  } catch (error) {
    return failure(error)
  }
}

async function mutate(request: NextRequest, add: boolean) {
  const denied = requireMutation(request)
  if (denied) return denied
  const body = await bodyObject(request)
  const itemKey = itemKeyFromBody(body?.itemKey)
  if (!itemKey) return json({ error: 'Invalid item key.' }, 400)
  try {
    const user = await currentUser()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    await setFavorite(user.id, itemKey, add)
    return json({ ok: true })
  } catch (error) {
    return failure(error)
  }
}

export async function PUT(request: NextRequest) {
  return mutate(request, true)
}

export async function DELETE(request: NextRequest) {
  return mutate(request, false)
}

export async function PATCH(request: NextRequest) {
  const denied = requireMutation(request)
  if (denied) return denied
  const body = await bodyObject(request, 5_000_000)
  const changes = itemChangesFromBody(body?.changes)
  const unavailableChanges = itemChangesFromBody(body?.unavailableChanges)
  if (!changes || !unavailableChanges || (!changes.length && !unavailableChanges.length))
    return json({ error: 'Invalid item changes.' }, 400)
  try {
    const user = await currentUser()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    return json(await applyItemChanges(user.id, changes, unavailableChanges))
  } catch (error) {
    return failure(error)
  }
}
