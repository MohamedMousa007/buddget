import { describe, expect, it } from 'vitest'
import { smsAccountsOn, smsLoggedThisMonth } from './proof'

describe('proof counts', () => {
  it('counts accounts with SMS on', () => {
    expect(smsAccountsOn([{ trackSms: true }, { trackSms: false }, {}, { trackSms: true }])).toBe(2)
  })
  it('counts only message-created expenses of this month', () => {
    const now = new Date(2026, 10, 15)
    expect(smsLoggedThisMonth([{ smsLogId: 'a', date: '2026-11-02' }, { smsLogId: 'b', date: '2026-10-30' }, { date: '2026-11-03' }], now)).toBe(1)
  })
})
