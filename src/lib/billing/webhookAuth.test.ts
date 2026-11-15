import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { SIGNATURE_HEADER, verifyRevenueCatRequest } from './webhookAuth'

const SECRETS = { authorization: 'auth-secret', hmac: 'hmac-secret' }
const NOW = Date.UTC(2026, 11, 1, 12, 0, 0)
const BODY = '{"event":{"type":"RENEWAL","id":"e1"}}'

function request(over: { auth?: string | null; ts?: number | string | null; body?: string; sign?: string; sig?: string | null } = {}) {
  const ts = over.ts === undefined ? String(Math.floor(NOW / 1000)) : over.ts
  const sig = over.sig === undefined ? createHmac('sha256', over.sign ?? SECRETS.hmac).update(`${ts}.${BODY}`).digest('hex') : over.sig
  const map = new Map<string, string>()
  if (over.auth !== null) map.set('authorization', over.auth ?? `Bearer ${SECRETS.authorization}`)
  // RevenueCat sends one header: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`.
  if (sig !== null) map.set(SIGNATURE_HEADER, ts === null ? `v1=${sig}` : `t=${ts},v1=${sig}`)
  return { raw: over.body ?? BODY, headers: { get: (k: string) => map.get(k.toLowerCase()) ?? null } }
}
const check = (r: ReturnType<typeof request>, secrets: { authorization?: string; hmac?: string } = SECRETS, now = NOW) => verifyRevenueCatRequest(r.raw, r.headers, secrets, now)

describe('verifyRevenueCatRequest', () => {
  it('accepts a request that carries the secret and a signature over timestamp plus raw body', () => {
    expect(check(request())).toBe('ok')
    expect(check(request({ auth: SECRETS.authorization }))).toBe('ok')
  })
  it('accepts a millisecond timestamp too', () => {
    expect(check(request({ ts: NOW }))).toBe('ok')
  })
  it('refuses a wrong or missing Authorization secret', () => {
    expect(check(request({ auth: 'Bearer nope' }))).toBe('unauthorized')
    expect(check(request({ auth: null }))).toBe('unauthorized')
  })
  it('refuses a missing, malformed or wrongly keyed signature, and a missing timestamp', () => {
    expect(check(request({ sig: null }))).toBe('unauthorized')
    expect(check(request({ sig: 'zz' }))).toBe('unauthorized')
    expect(check(request({ sign: 'other-secret' }))).toBe('unauthorized')
    expect(check(request({ ts: null }))).toBe('unauthorized')
  })
  it('reads the documented single-header format, in either order, and refuses a bare hex signature', () => {
    const ts = String(Math.floor(NOW / 1000))
    const sig = createHmac('sha256', SECRETS.hmac).update(`${ts}.${BODY}`).digest('hex')
    const with_ = (value: string) => ({ get: (k: string) => (k.toLowerCase() === 'authorization' ? `Bearer ${SECRETS.authorization}` : k.toLowerCase() === SIGNATURE_HEADER ? value : null) })
    expect(verifyRevenueCatRequest(BODY, with_(`v1=${sig},t=${ts}`), SECRETS, NOW)).toBe('ok')
    expect(verifyRevenueCatRequest(BODY, with_(` t=${ts} , v1=${sig} `), SECRETS, NOW)).toBe('ok')
    expect(verifyRevenueCatRequest(BODY, with_(sig), SECRETS, NOW)).toBe('unauthorized')
  })
  it('refuses a body changed after signing', () => {
    const good = request()
    expect(verifyRevenueCatRequest(good.raw + ' ', good.headers, SECRETS, NOW)).toBe('unauthorized')
  })
  it('refuses a replay outside the 5-minute window, in either direction, and accepts one inside it', () => {
    const at = (offsetMs: number) => request({ ts: Math.floor((NOW + offsetMs) / 1000) })
    expect(check(at(-6 * 60_000))).toBe('stale')
    expect(check(at(6 * 60_000))).toBe('stale')
    expect(check(at(-4 * 60_000))).toBe('ok')
  })
  it('does not authenticate while either secret is unset', () => {
    expect(check(request(), { authorization: 'auth-secret' })).toBe('not_configured')
    expect(check(request(), { hmac: 'hmac-secret' })).toBe('not_configured')
    expect(check(request(), {})).toBe('not_configured')
  })
})
