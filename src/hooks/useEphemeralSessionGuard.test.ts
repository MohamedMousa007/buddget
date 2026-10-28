import { describe, expect, it } from 'vitest'
import { ephemeralSessionExpired } from './useEphemeralSessionGuard'

describe('ephemeralSessionExpired', () => {
  const now = 1_000_000_000

  it('does nothing without a marker (remember me on)', () => {
    expect(ephemeralSessionExpired(null, now)).toBe(false)
  })

  it('survives a reload or a second tab while a tab renewed the marker recently', () => {
    expect(ephemeralSessionExpired(String(now - 30_000), now)).toBe(false)
  })

  it('ends the session once nothing has renewed the marker for the grace period', () => {
    expect(ephemeralSessionExpired(String(now - 5 * 60_000), now)).toBe(true)
  })

  it('treats a corrupt marker as expired', () => {
    expect(ephemeralSessionExpired('x', now)).toBe(true)
  })
})
