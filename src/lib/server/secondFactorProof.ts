import { createHmac, timingSafeEqual } from 'node:crypto'

/** A verified second factor is remembered for this long in the signed cookie, so a cold serverless instance need not ask the database again. */
export const PROOF_TTL_MS = 5 * 60_000
export const PROOF_COOKIE = 'b2f'

const sign = (secret: string, sessionId: string, userId: string, exp: number) =>
  createHmac('sha256', secret).update(`second-factor:${sessionId}:${userId}:${exp}`).digest('hex')

/** `exp.signature`: bound to one session and user, unforgeable without the server secret, never contains the secret. */
export function mintProof(secret: string | undefined, sessionId: string, userId: string, now = Date.now()): string | null {
  if (!secret) return null
  const exp = now + PROOF_TTL_MS
  return `${exp}.${sign(secret, sessionId, userId, exp)}`
}

export function verifyProof(secret: string | undefined, value: string | undefined, sessionId: string, userId: string, now = Date.now()): boolean {
  if (!secret || !value) return false
  const [expRaw, sig = ''] = value.split('.')
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= now || exp > now + PROOF_TTL_MS) return false
  const want = Buffer.from(sign(secret, sessionId, userId, exp))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}
