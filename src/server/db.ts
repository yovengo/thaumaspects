import 'server-only'
import { Pool, type PoolClient, type QueryResultRow } from 'pg'

let pool: Pool | undefined

export function database(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not configured')
  if (!pool) {
    const uri = new URL(connectionString)
    if (uri.searchParams.get('sslmode') !== 'verify-full')
      throw new Error('DATABASE_URL must use sslmode=verify-full')
    const ca = process.env.DATABASE_CA_CERT_BASE64
      ? Buffer.from(process.env.DATABASE_CA_CERT_BASE64, 'base64').toString('utf8')
      : ''
    if (!ca.includes('-----BEGIN CERTIFICATE-----'))
      throw new Error('DATABASE_CA_CERT_BASE64 is not configured')
    uri.searchParams.delete('sslmode')
    pool = new Pool({
      connectionString: uri.toString(),
      max: 1,
      ssl: { ca, rejectUnauthorized: true, servername: uri.hostname },
      idleTimeoutMillis: 10000,
    })
  }
  return pool
}

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await database().query<T>(sql, params)
  return result.rows
}

export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect()
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
