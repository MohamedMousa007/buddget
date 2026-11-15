import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SIGNATURE_HEADER = 'x-revenuecat-webhook-signature'
const WINDOW_MS = 5 * 60_000

export type WebhookAuth = 'ok' | 'not_configured' | 'unauthorized' | 'stale'

interface HeaderReader { get(name: string): string | null }

/** Compared as digests so the comparison takes the same time whatever the lengths. */
const sameSecret = (given: string, expected: string): boolean =>
  timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest())

/** `t=<unix seconds>,v1=<hex>` (RevenueCat's documented format, read 2026-11-15); parts in any order. */
function parseSignature(header: string): { stamp: string; v1: string } | null {
  const parts = new Map(header.split(',').map((p) => p.trim().split('=', 2) as [string, string | undefined]))
  const stamp = parts.get('t')
  const v1 = parts.get('v1')
  return stamp && v1 ? { stamp, v1 } : null
}

/**
 * Both checks S5c item 13 asks for: the `Authorization` secret, and RevenueCat's HMAC-SHA256 signature over
 * `<t>.<raw body>`, sent as `X-RevenueCat-Webhook-Signature: t=<unix seconds>,v1=<hex>`, no older or newer than 5 minutes. Neither is accepted alone, and while either secret is unset nothing
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

  const parsed = parseSignature(headers.get(SIGNATURE_HEADER) ?? '')
  if (!parsed) return 'unauthorized'
  const { stamp } = parsed
  const expected = createHmac('sha256', secrets.hmac).update(`${stamp}.${raw}`).digest()
  const given = Buffer.from(parsed.v1, 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return 'unauthorized'

  const value = Number(stamp)
  if (!Number.isFinite(value)) return 'unauthorized'
  const stampMs = value < 1e12 ? value * 1000 : value
  return Math.abs(now - stampMs) > WINDOW_MS ? 'stale' : 'ok'
}
