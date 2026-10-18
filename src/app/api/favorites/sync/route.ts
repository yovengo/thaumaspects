import type { NextRequest } from 'next/server'
import { database } from '@/server/db'
import { itemKeysFromBody } from '@/server/favorites'
import { bodyObject, currentUser, failure, json, requireMutation } from '@/server/http'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = requireMutation(request)
  if (denied) return denied
  const body = await bodyObject(request, 5_000_000)
  const items = itemKeysFromBody(body?.items)
  if (!items) return json({ error: 'Invalid favorites.' }, 400)
  try {
    const user = await currentUser()
    if (!user) return json({ error: 'Sign in required.' }, 401)
    const client = await database().connect()
    try {
      await client.query('BEGIN')
      if (items.length)
        await client.query(
          `INSERT INTO private.app_favorites (user_id,item_key)
        SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING`,
          [user.id, items],
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
