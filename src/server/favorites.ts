import 'server-only'
import type { PoolClient } from 'pg'
import { query, transaction } from '@/server/db'
import { partitionItemChanges } from '@/server/favoriteInput'

export type CloudItems = { items: string[]; unavailable: string[] }
type Change = [string, 'add' | 'remove']

async function readItems(userId: string, client?: PoolClient): Promise<CloudItems> {
  const sql = `SELECT item_key,unavailable FROM (
    SELECT item_key,created_at,false AS unavailable FROM private.app_favorites WHERE user_id=$1
    UNION ALL
    SELECT item_key,created_at,true AS unavailable FROM private.app_unavailable_items WHERE user_id=$1
  ) AS sources ORDER BY created_at,item_key`
  const rows = client
    ? (await client.query<{ item_key: string; unavailable: boolean }>(sql, [userId])).rows
    : await query<{ item_key: string; unavailable: boolean }>(sql, [userId])
  return {
    items: rows.filter((row) => !row.unavailable).map((row) => row.item_key),
    unavailable: rows.filter((row) => row.unavailable).map((row) => row.item_key),
  }
}

export function getItems(userId: string) {
  return readItems(userId)
}

export async function setFavorite(userId: string, itemKey: string, add: boolean) {
  if (!add) {
    await query('DELETE FROM private.app_favorites WHERE user_id=$1 AND item_key=$2', [
      userId,
      itemKey,
    ])
    return
  }
  await transaction(async (client) => {
    await client.query(
      'DELETE FROM private.app_unavailable_items WHERE user_id=$1 AND item_key=$2',
      [userId, itemKey],
    )
    await client.query(
      'INSERT INTO private.app_favorites (user_id,item_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [userId, itemKey],
    )
  })
}

async function insertItems(
  client: PoolClient,
  table: 'app_favorites' | 'app_unavailable_items',
  userId: string,
  items: string[],
) {
  if (items.length)
    await client.query(
      `INSERT INTO private.${table} (user_id,item_key)
      SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING`,
      [userId, items],
    )
}

async function deleteItems(
  client: PoolClient,
  table: 'app_favorites' | 'app_unavailable_items',
  userId: string,
  items: string[],
) {
  if (items.length)
    await client.query(
      `DELETE FROM private.${table} WHERE user_id=$1 AND item_key=ANY($2::text[])`,
      [userId, items],
    )
}

export function applyItemChanges(userId: string, changes: Change[], unavailableChanges: Change[]) {
  const batch = partitionItemChanges(changes, unavailableChanges)
  return transaction(async (client) => {
    await deleteItems(client, 'app_favorites', userId, batch.favoriteRemove)
    await deleteItems(client, 'app_unavailable_items', userId, batch.unavailableRemove)
    await insertItems(client, 'app_favorites', userId, batch.favoriteAdd)
    await insertItems(client, 'app_unavailable_items', userId, batch.unavailableAdd)
    return readItems(userId, client)
  })
}

export function mergeLocalItems(userId: string, items: string[], unavailable: string[]) {
  const preferred = items.filter((item) => !unavailable.includes(item))
  return transaction(async (client) => {
    await deleteItems(client, 'app_favorites', userId, unavailable)
    await deleteItems(client, 'app_unavailable_items', userId, preferred)
    await insertItems(client, 'app_favorites', userId, preferred)
    await insertItems(client, 'app_unavailable_items', userId, unavailable)
    return readItems(userId, client)
  })
}
