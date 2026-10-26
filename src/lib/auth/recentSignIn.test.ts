import { describe, expect, it } from 'vitest'
import { signedInWithin } from './recentSignIn'

const now = 1_000_000_000_000
describe('signedInWithin', () => {
  it('accepts a fresh matching method', () => {
    expect(signedInWithin([{ method: 'otp', timestamp: now / 1000 - 30 }], ['otp'], 600, now)).toBe(true)
  })
  it('rejects a stale one', () => {
    expect(signedInWithin([{ method: 'otp', timestamp: now / 1000 - 3600 }], ['otp'], 600, now)).toBe(false)
  })
  it('rejects a different method', () => {
    expect(signedInWithin([{ method: 'password', timestamp: now / 1000 }], ['otp'], 600, now)).toBe(false)
  })
  it('rejects no amr', () => {
    expect(signedInWithin([], ['otp'], 600, now)).toBe(false)
  })
})
