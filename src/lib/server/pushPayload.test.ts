import { describe, expect, it } from 'vitest'
import { capCollapseKey, isDeadTokenCode, safeData } from '@/lib/server/pushPayload'

describe('NAT-5 push payload faults never delete tokens', () => {
  it('only unregistered/invalid-token codes are dead', () => {
    expect(isDeadTokenCode('messaging/registration-token-not-registered')).toBe(true)
    expect(isDeadTokenCode('messaging/invalid-registration-token')).toBe(true)
    expect(isDeadTokenCode('messaging/invalid-argument')).toBe(false)
    expect(isDeadTokenCode('')).toBe(false)
  })
  it('caps the collapse key at 64 bytes, multi-byte safe', () => {
    expect(new TextEncoder().encode(capCollapseKey('a'.repeat(120))!).length).toBe(64)
    expect(new TextEncoder().encode(capCollapseKey('م'.repeat(60))!).length).toBeLessThanOrEqual(64)
    expect(capCollapseKey(undefined)).toBeUndefined()
  })
  it('drops reserved data keys', () => {
    expect(safeData({ kind: 'x', from: 'y', 'google.c.a': 'z', gcm_x: 'ok' })).toEqual({ kind: 'x', gcm_x: 'ok' })
  })
})
