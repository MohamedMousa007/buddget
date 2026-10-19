import { createHmac, timingSafeEqual } from 'node:crypto'

const TOLERANCE_S = 300

/**
 * Verifies a Standard Webhooks signature (Resend's Svix and Supabase auth hooks both use it):
 * HMAC-SHA256 of `id.timestamp.body`, base64, compared against each `v1,<sig>` in the header.
 */
export function verifySignedWebhook(
  h: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!h.id || !h.timestamp || !h.signature) return false
  const ts = Number(h.timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_S) return false
  const key = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${h.id}.${h.timestamp}.${body}`).digest()
  return h.signature.split(' ').some((part) => {
    const sig = Buffer.from(part.replace(/^v1,/, ''), 'base64')
    return sig.length === expected.length && timingSafeEqual(sig, expected)
  })
}
