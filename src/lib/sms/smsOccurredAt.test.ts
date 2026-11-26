import { describe, expect, it } from 'vitest'
import { smsOccurredAt } from '@/lib/sms/createSmsExpense'

describe('smsOccurredAt', () => {
  const now = new Date('2026-11-26T09:41:00.000Z')

  it('prefers the believable capture time, then the SMS received time', () => {
    expect(smsOccurredAt({ occurredAtIso: '2026-11-26T08:00:00.000Z', receivedAtIso: '2026-11-26T08:05:00.000Z' }, now)).toBe('2026-11-26T08:00:00.000Z')
    expect(smsOccurredAt({ occurredAtIso: null, receivedAtIso: '2026-11-26T08:05:00.000Z' }, now)).toBe('2026-11-26T08:05:00.000Z')
  })

  it('falls back to the creation time, never a missing time', () => {
    expect(smsOccurredAt({ occurredAtIso: null, receivedAtIso: null }, now)).toBe(now.toISOString())
    expect(smsOccurredAt({}, now)).toBe(now.toISOString())
  })
})
