import type { NextRequest } from 'next/server'
import { database, query } from '@/server/db'
import { itemKeyFromBody } from '@/server/favorites'
import { bodyObject, currentUser, failure, json, requireMutation } from '@/server/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    const rows = await query<{ item_key: string }>(
      'SELECT item_key FROM private.app_favorites WHERE user_id=$1 ORDER BY created_at,item_key',
      [user.id],
    )
    return json({ items: rows.map((row) => row.item_key) })
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
    if (add)
      await query(
        'INSERT INTO private.app_favorites (user_id,item_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [user.id, itemKey],
      )
    else
      await query('DELETE FROM private.app_favorites WHERE user_id=$1 AND item_key=$2', [
        user.id,
        itemKey,
      ])
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
  const changes = body?.changes
  if (!changes || typeof changes !== 'object' || Array.isArray(changes))
    return json({ error: 'Invalid favorites.' }, 400)
  const entries = Object.entries(changes)
  if (
    !entries.length ||
    entries.length > 500 ||
    entries.some(
      ([key, action]) => !itemKeyFromBody(key) || (action !== 'add' && action !== 'remove'),
    )
  ) {
    return json({ error: 'Invalid favorites.' }, 400)
  }
  try {
    const user = await currentUser()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    const added = entries.filter(([, action]) => action === 'add').map(([key]) => key)
    const removed = entries.filter(([, action]) => action === 'remove').map(([key]) => key)
    const client = await database().connect()
    try {
      await client.query('BEGIN')
      if (removed.length)
        await client.query(
          'DELETE FROM private.app_favorites WHERE user_id=$1 AND item_key=ANY($2::text[])',
          [user.id, removed],
        )
      if (added.length)
        await client.query(
          `INSERT INTO private.app_favorites (user_id,item_key)
        SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING`,
          [user.id, added],
        )
      const rows = await client.query<{ item_key: string }>(
        'SELECT item_key FROM private.app_favorites WHERE user_id=$1 ORDER BY created_at,item_key',
        [user.id],
      )
      await client.query('COMMIT')
      return json({ items: rows.rows.map((row) => row.item_key) })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return failure(error)
  }
}
