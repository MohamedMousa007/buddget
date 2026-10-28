import { describe, expect, it } from 'vitest'
import { authHookIdempotencyKey, SUPPRESSION_DAYS, suppressionFor } from './suppression'

const NOW = Date.parse('2026-10-28T00:00:00Z')

describe('suppressionFor', () => {
  it('suppresses a hard bounce for 30 days, lower-cased', () => {
    const [row] = suppressionFor('email.bounced', { to: ['Sara@Example.com'], bounce: { type: 'Permanent' } }, NOW)
    expect(row).toEqual({ email: 'sara@example.com', reason: 'bounced', expires_at: new Date(NOW + SUPPRESSION_DAYS.bounced * 86_400_000).toISOString() })
  })
  it('suppresses complaints for 90 days', () => {
    expect(suppressionFor('email.complained', { to: ['a@b.co'] }, NOW)[0]?.reason).toBe('complained')
  })
  it('ignores soft bounces, deliveries and bad recipients', () => {
    expect(suppressionFor('email.bounced', { to: ['a@b.co'], bounce: { type: 'Transient' } }, NOW)).toEqual([])
    expect(suppressionFor('email.delivered', { to: ['a@b.co'] }, NOW)).toEqual([])
    expect(suppressionFor('email.complained', { to: ['nope'] }, NOW)).toEqual([])
  })
})

describe('authHookIdempotencyKey', () => {
  it('is deterministic per event and recipient', () => {
    expect(authHookIdempotencyKey('msg_1', 'password_reset', 'A@b.co')).toBe(authHookIdempotencyKey('msg_1', 'password_reset', 'a@b.co'))
    expect(authHookIdempotencyKey('msg_1', 'email_change', 'a@b.co')).not.toBe(authHookIdempotencyKey('msg_1', 'password_reset', 'a@b.co'))
    expect(authHookIdempotencyKey('msg_2', 'password_reset', 'a@b.co')).not.toBe(authHookIdempotencyKey('msg_1', 'password_reset', 'a@b.co'))
  })
  it('has no key without a webhook id', () => expect(authHookIdempotencyKey(null, 'x', 'a@b.co')).toBeUndefined())
})
