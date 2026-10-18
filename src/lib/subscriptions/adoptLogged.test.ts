import { describe, expect, it } from 'vitest'
import { loggedChargesAdopted } from './adoptLogged'

const e = (id: string, date: string, over = {}) => ({ id, date, linkedSubscriptionId: 's1', isRecurring: true, smsLogId: undefined as string | undefined, ...over })
const sms = { id: 'sms1', linkedSubscriptionId: 's1', smsLogId: 'log1', date: '2026-10-19' }

describe('loggedChargesAdopted', () => {
  it('replaces the app-written charge of the same cycle', () => {
    expect(loggedChargesAdopted([e('a', '2026-10-19'), e('b', '2026-10-17')], sms)).toEqual(['a', 'b'])
  })
  it('keeps charges from other cycles, other subscriptions, real SMS rows and manual expenses', () => {
    const list = [e('far', '2026-09-19'), e('other', '2026-10-19', { linkedSubscriptionId: 's2' }), e('real', '2026-10-19', { smsLogId: 'x' }), e('manual', '2026-10-19', { isRecurring: false })]
    expect(loggedChargesAdopted(list, sms)).toEqual([])
  })
  it('does nothing for an incoming charge that has no SMS behind it', () => {
    expect(loggedChargesAdopted([e('a', '2026-10-19')], { ...sms, smsLogId: undefined })).toEqual([])
  })
})
