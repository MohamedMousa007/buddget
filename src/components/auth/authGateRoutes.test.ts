import { describe, expect, it } from 'vitest'
import { isAuthGateBypassRoute } from './authGateRoutes'

describe('isAuthGateBypassRoute', () => {
  it('lets the inbound auth flow, legal pages and the invite landing through', () => {
    for (const p of ['/reset-password', '/auth/callback', '/legal/privacy', '/i/MOHAME-7K2']) {
      expect(isAuthGateBypassRoute(p)).toBe(true)
    }
  })
  it('keeps every app screen behind the gate, including look-alike prefixes of /i/', () => {
    for (const p of ['/', '/flow', '/i', '/income', '/insights', '/settings']) {
      expect(isAuthGateBypassRoute(p)).toBe(false)
    }
  })
})
