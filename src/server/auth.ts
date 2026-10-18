import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
} from 'node:crypto'

export const SESSION_COOKIE = 'thaumaspects_session'
export const SESSION_AGE_SECONDS = 30 * 24 * 60 * 60

function secret() {
  const value = process.env.AUTH_CODE_SECRET
  if (!value || value.length < 32)
    throw new Error('AUTH_CODE_SECRET must have at least 32 characters')
  return value
}

export function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{5}-?\d{5}$/.test(value)) return null
  return value.replace('-', '')
}

export function generateCode(): string {
  const digits = Array.from({ length: 10 }, () => randomInt(0, 10)).join('')
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function codeHash(digits: string): string {
  return createHmac('sha256', secret()).update(`code:${digits}`).digest('hex')
}

function codeEncryptionKey(): Buffer {
  return Buffer.from(
    hkdfSync('sha256', secret(), 'thaumaspects-auth-v1', 'access-code-encryption', 32),
  )
}

export function encryptCode(code: string, userId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', codeEncryptionKey(), iv)
  cipher.setAAD(Buffer.from(userId))
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()])
  return `v1.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`
}

export function decryptCode(encrypted: string, userId: string): string {
  const parts = encrypted.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Unsupported access code format')
  const iv = Buffer.from(parts[1], 'base64url')
  const ciphertext = Buffer.from(parts[2], 'base64url')
  const tag = Buffer.from(parts[3], 'base64url')
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length !== 11)
    throw new Error('Invalid access code data')
  const decipher = createDecipheriv('aes-256-gcm', codeEncryptionKey(), iv)
  decipher.setAAD(Buffer.from(userId))
  decipher.setAuthTag(tag)
  const code = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  if (!/^\d{5}-\d{5}$/.test(code)) throw new Error('Invalid access code data')
  return code
}

export function rateKey(value: string): string {
  return createHmac('sha256', secret()).update(`rate:${value}`).digest('hex')
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function sessionHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
