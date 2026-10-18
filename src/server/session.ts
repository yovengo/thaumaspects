import type { NextResponse } from 'next/server'
import {
  codeHash,
  createSessionToken,
  encryptCode,
  generateCode,
  normalizeCode,
  SESSION_AGE_SECONDS,
  SESSION_COOKIE,
  sessionHash,
} from './auth'
import { database, query } from './db'

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_AGE_SECONDS,
  })
}

export async function openSessionForCode(
  code: string,
): Promise<{ userId: string; token: string } | null> {
  const token = createSessionToken()
  const client = await database().connect()
  try {
    await client.query('BEGIN')
    const users = await client.query<{ id: string; code_encrypted: string | null }>(
      'SELECT id,code_encrypted FROM private.app_users WHERE code_hash=$1 FOR UPDATE',
      [codeHash(code)],
    )
    const user = users.rows[0]
    if (!user) {
      await client.query('ROLLBACK')
      return null
    }
    if (!user.code_encrypted) {
      await client.query('UPDATE private.app_users SET code_encrypted=$1 WHERE id=$2', [
        encryptCode(`${code.slice(0, 5)}-${code.slice(5)}`, user.id),
        user.id,
      ])
    }
    await client.query(
      `INSERT INTO private.app_sessions (user_id,token_hash,expires_at)
      VALUES ($1,$2,now()+interval '30 days')`,
      [user.id, sessionHash(token)],
    )
    await client.query('COMMIT')
    return { userId: user.id, token }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function createAccount(): Promise<{ userId: string; code: string; token: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const client = await database().connect()
    try {
      await client.query('BEGIN')
      const users = await client.query<{ id: string }>(
        `INSERT INTO private.app_users (code_hash) VALUES ($1)
        ON CONFLICT (code_hash) DO NOTHING RETURNING id`,
        [codeHash(normalizeCode(code)!)],
      )
      if (!users.rows[0]) {
        await client.query('ROLLBACK')
        continue
      }
      await client.query('UPDATE private.app_users SET code_encrypted=$1 WHERE id=$2', [
        encryptCode(code, users.rows[0].id),
        users.rows[0].id,
      ])
      const token = createSessionToken()
      await client.query(
        `INSERT INTO private.app_sessions (user_id,token_hash,expires_at)
        VALUES ($1,$2,now()+interval '30 days')`,
        [users.rows[0].id, sessionHash(token)],
      )
      await client.query('COMMIT')
      return { userId: users.rows[0].id, code, token }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  throw new Error('Unable to generate unique code')
}

export async function rotateAccountCode(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    try {
      const rows = await query<{ id: string }>(
        `UPDATE private.app_users SET code_hash=$1,code_encrypted=$3 WHERE id=$2
        AND NOT EXISTS (SELECT 1 FROM private.app_users WHERE code_hash=$1) RETURNING id`,
        [codeHash(normalizeCode(code)!), userId, encryptCode(code, userId)],
      )
      if (rows[0]) return code
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error
    }
  }
  throw new Error('Unable to generate unique code')
}

export async function confirmLegacyCode(userId: string, code: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE private.app_users SET code_encrypted=$1
    WHERE id=$2 AND code_hash=$3 AND code_encrypted IS NULL RETURNING id`,
    [encryptCode(`${code.slice(0, 5)}-${code.slice(5)}`, userId), userId, codeHash(code)],
  )
  return Boolean(rows[0])
}
