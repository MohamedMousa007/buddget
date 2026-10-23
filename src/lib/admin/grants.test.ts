import { describe, expect, it } from 'vitest'
import { GRANT_MINUTES, checkReason, grantExpiry, grantState } from './grants'

const NOW = Date.parse('2026-10-23T12:00:00Z')
const at = (min: number) => new Date(NOW + min * 60_000).toISOString()

describe('grantState', () => {
  it('is pending until someone approves, then active until it expires', () => {
    expect(grantState({ approved_at: null, expires_at: null, revoked_at: null }, NOW)).toBe('pending')
    expect(grantState({ approved_at: at(-1), expires_at: at(29), revoked_at: null }, NOW)).toBe('active')
    expect(grantState({ approved_at: at(-31), expires_at: at(-1), revoked_at: null }, NOW)).toBe('expired')
  })
  it('a revoked grant is dead whatever its dates say', () => {
    expect(grantState({ approved_at: at(-1), expires_at: at(29), revoked_at: at(0) }, NOW)).toBe('revoked')
  })
  it('expires exactly at the boundary', () => {
    expect(grantState({ approved_at: at(-30), expires_at: at(0), revoked_at: null }, NOW)).toBe('expired')
  })
})

describe('grant length and reason', () => {
  it('lasts thirty minutes', () => {
    expect(Date.parse(grantExpiry(NOW)) - NOW).toBe(GRANT_MINUTES * 60_000)
  })
  it('asks for a real reason and trims it', () => {
    expect(checkReason('  Ticket 214: sms import failing  ')).toEqual({ ok: true, reason: 'Ticket 214: sms import failing' })
    expect(checkReason('short')).toMatchObject({ ok: false })
    expect(checkReason(undefined)).toMatchObject({ ok: false })
    expect((checkReason('x'.repeat(900)) as { reason: string }).reason).toHaveLength(500)
  })
})
