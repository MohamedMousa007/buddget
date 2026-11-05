import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { DEVICE_ID_HEADER, DEVICE_ID_PATTERN, DEVICE_SECRET_HEADER } from '@/lib/auth/deviceIdConstants'
import { readDeviceSecretCookie, setDeviceSecretCookie } from '@/lib/auth/deviceCookie'

const SECRET_PATTERN = /^[0-9a-f]{64}$/

export function newDeviceSecret(): { secret: string; hash: string } {
  const secret = randomBytes(32).toString('hex')
  return { secret, hash: createHash('sha256').update(secret).digest('hex') }
}

/** The secret the caller presented: the header on native (as the device id), else the HttpOnly cookie on web. */
export async function readDeviceSecret(request: Request): Promise<string | null> {
  const fromHeader = request.headers.get(DEVICE_SECRET_HEADER)?.trim().toLowerCase()
  if (fromHeader && SECRET_PATTERN.test(fromHeader)) return fromHeader
  return readDeviceSecretCookie()
}

/** Constant-time compare of the presented secret's hash with the stored one. */
export function secretMatches(secret: string | null, storedHash: string): boolean {
  if (!secret) return false
  const provided = createHash('sha256').update(secret).digest()
  const stored = Buffer.from(storedHash, 'hex')
  return stored.length === provided.length && timingSafeEqual(stored, provided)
}

const callerIsNative = (request: Request): boolean => DEVICE_ID_PATTERN.test(request.headers.get(DEVICE_ID_HEADER)?.trim() ?? '')

/**
 * Hands a freshly issued secret to the client. Native (cookies are not shared) gets it in the response body to keep in
 * its own storage; web gets an HttpOnly cookie and never sees it in script.
 */
export async function deliverDeviceSecret(request: Request, secret: string): Promise<{ deviceSecret?: string }> {
  if (callerIsNative(request)) return { deviceSecret: secret }
  await setDeviceSecretCookie(secret)
  return {}
}
