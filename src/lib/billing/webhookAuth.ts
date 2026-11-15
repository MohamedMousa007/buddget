import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SIGNATURE_HEADER = 'x-revenuecat-webhook-signature'
export const TIMESTAMP_HEADER = 'x-revenuecat-webhook-timestamp'
const WINDOW_MS = 5 * 60_000

export type WebhookAuth = 'ok' | 'not_configured' | 'unauthorized' | 'stale'

interface HeaderReader { get(name: string): string | null }

/** Compared as digests so the comparison takes the same time whatever the lengths. */
const sameSecret = (given: string, expected: string): boolean =>
  timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest())

/**
 * Both checks S5c item 13 asks for: the `Authorization` secret, and an HMAC-SHA256 signature over `timestamp.rawBody`
 * (hex, in `X-RevenueCat-Webhook-Signature`, with the timestamp in `X-RevenueCat-Webhook-Timestamp`, seconds or
 * milliseconds) no older or newer than 5 minutes. Neither is accepted alone, and while either secret is unset nothing
 * authenticates, so a half-configured deployment fails closed. `raw` must be the body exactly as received.
 */
export function verifyRevenueCatRequest(
  raw: string,
  headers: HeaderReader,
  secrets: { authorization?: string; hmac?: string },
  now = Date.now(),
): WebhookAuth {
  if (!secrets.authorization || !secrets.hmac) return 'not_configured'
  const header = headers.get('authorization') ?? ''
  if (!sameSecret(header.startsWith('Bearer ') ? header.slice(7) : header, secrets.authorization)) return 'unauthorized'

  const stamp = headers.get(TIMESTAMP_HEADER)
  const signature = headers.get(SIGNATURE_HEADER)
  if (!stamp || !signature) return 'unauthorized'
  const expected = createHmac('sha256', secrets.hmac).update(`${stamp}.${raw}`).digest()
  const given = Buffer.from(signature, 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return 'unauthorized'

  const value = Number(stamp)
  if (!Number.isFinite(value)) return 'unauthorized'
  const stampMs = value < 1e12 ? value * 1000 : value
  return Math.abs(now - stampMs) > WINDOW_MS ? 'stale' : 'ok'
}
