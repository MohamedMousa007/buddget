import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import { getSupabaseSecretKey } from '@/lib/supabase/env'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LEN = 64

export const MIN_PASSWORD_LENGTH = 12

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEY_LEN, SCRYPT)
  return `scrypt$${SCRYPT.N}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !n || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, { ...SCRYPT, N: Number(n) })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password.length > 256) return 'Password is too long.'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Mix upper case, lower case and a number.'
  }
  if (/^(.)\1+$/.test(password)) return 'Password is too repetitive.'
  return null
}

/**
 * Key for encrypting TOTP secrets at rest and nothing else. `ADMIN_AUTH_SECRET` pins it explicitly;
 * otherwise it derives from the Supabase secret key, so the portal works with no extra configuration.
 */
function dataKey(): Buffer {
  const material = process.env.ADMIN_AUTH_SECRET?.trim() || getSupabaseSecretKey()
  if (!material) throw new Error('Admin portal needs ADMIN_AUTH_SECRET or SUPABASE_SECRET_KEY')
  return Buffer.from(hkdfSync('sha256', material, 'buddget-admin', 'totp-secret-v1', 32))
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', dataKey(), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`
}

export function decryptSecret(packed: string): string {
  const [v, iv, tag, body] = packed.split('.')
  if (v !== 'v1' || !iv || !tag || !body) throw new Error('Unreadable secret')
  const decipher = createDecipheriv('aes-256-gcm', dataKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
}

/** 10 single-use recovery codes, formatted `xxxxx-xxxxx`. Only their hashes are stored. */
export function generateRecoveryCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString('hex')
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
  return { codes, hashes: codes.map(hashRecoveryCode) }
}

export function normalizeRecoveryCode(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '')
}

export function hashRecoveryCode(code: string): string {
  return sha256Hex(`recovery:${normalizeRecoveryCode(code)}`)
}
