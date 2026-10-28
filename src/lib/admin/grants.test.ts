import { describe, expect, it } from 'vitest'
import { GRANT_MINUTES, REQUEST_EXPIRES_DAYS, checkReason, grantExpiry, grantState } from './grants'

const NOW = Date.parse('2026-10-23T12:00:00Z')
const at = (min: number) => new Date(NOW + min * 60_000).toISOString()
const base = { approved_at: null, expires_at: null, revoked_at: null }

describe('grantState', () => {
  it('is pending until the owner decides, then active until it expires', () => {
    expect(grantState({ ...base, requested_at: at(-5) }, NOW)).toBe('pending')
    expect(grantState({ approved_at: at(-1), expires_at: at(29), revoked_at: null }, NOW)).toBe('active')
    expect(grantState({ approved_at: at(-31), expires_at: at(-1), revoked_at: null }, NOW)).toBe('expired')
  })
  it('a revoked or denied grant is dead whatever its dates say', () => {
    expect(grantState({ approved_at: at(-1), expires_at: at(29), revoked_at: at(0) }, NOW)).toBe('revoked')
    expect(grantState({ ...base, denied_at: at(-1) }, NOW)).toBe('denied')
  })
  it('expires exactly at the boundary', () => {
    expect(grantState({ approved_at: at(-30), expires_at: at(0), revoked_at: null }, NOW)).toBe('expired')
  })
  it('a permanent grant has no end until it is revoked', () => {
    const permanent = { mode: 'permanent', approved_at: at(-100000), expires_at: null, revoked_at: null }
    expect(grantState(permanent, NOW)).toBe('active')
    expect(grantState({ ...permanent, revoked_at: at(-1) }, NOW)).toBe('revoked')
  })
  it('an approved one-time grant without an expiry is not open', () => {
    expect(grantState({ mode: 'one_time', approved_at: at(-1), expires_at: null, revoked_at: null }, NOW)).toBe('expired')
  })
  it('a request nobody answers stops waiting', () => {
    const old = new Date(NOW - (REQUEST_EXPIRES_DAYS + 1) * 86_400_000).toISOString()
    expect(grantState({ ...base, requested_at: old }, NOW)).toBe('expired')
  })
})

describe('grant length and reason', () => {
  it('a one-time grant lasts thirty minutes and a permanent one has no expiry', () => {
    expect(Date.parse(grantExpiry(NOW, 'one_time') as string) - NOW).toBe(GRANT_MINUTES * 60_000)
    expect(grantExpiry(NOW, 'permanent')).toBeNull()
  })
  it('asks for a real reason and trims it', () => {
    expect(checkReason('  Ticket 214: sms import failing  ')).toEqual({ ok: true, reason: 'Ticket 214: sms import failing' })
    expect(checkReason('short')).toMatchObject({ ok: false })
    expect(checkReason(undefined)).toMatchObject({ ok: false })
    expect((checkReason('x'.repeat(900)) as { reason: string }).reason).toHaveLength(500)
  })
})
