import { describe, expect, it } from 'vitest'
import { reviewFlags } from './accessReview'

const now = Date.parse('2026-10-23T00:00:00Z')
const base = { status: 'active' as const, secured: true, liveSessions: 1, last_login_at: '2026-10-20T00:00:00Z', created_at: '2026-01-01T00:00:00Z', extra_permissions: [] }

describe('reviewFlags', () => {
  it('is empty for a healthy account', () => expect(reviewFlags(base, now)).toEqual([]))
  it('flags missing 2FA, staleness and extra permissions', () => {
    expect(reviewFlags({ ...base, secured: false }, now)).toHaveLength(1)
    expect(reviewFlags({ ...base, last_login_at: '2026-06-01T00:00:00Z' }, now)[0]).toMatch(/No sign-in/)
    expect(reviewFlags({ ...base, last_login_at: null }, now)[0]).toMatch(/No sign-in/)
    expect(reviewFlags({ ...base, extra_permissions: ['users.pii'] }, now)[0]).toMatch(/1 permission added/)
  })
  it('ignores 2FA and staleness once suspended, but flags lingering sessions', () => {
    const f = reviewFlags({ ...base, status: 'suspended', secured: false, last_login_at: null, liveSessions: 0 }, now)
    expect(f).toEqual([])
    expect(reviewFlags({ ...base, status: 'suspended' }, now)[0]).toMatch(/Suspended/)
  })
})
