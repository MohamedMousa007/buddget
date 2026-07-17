import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import type { Expense, Subscription } from '@/lib/store/types'
import { cycleWindow, isCyclePaid } from './subscriptionOccurrence'

type Sub = Pick<Subscription, 'id' | 'startDate' | 'billingDay' | 'billingCycle'>

const sub = (over: Partial<Sub> = {}): Sub => ({
  id: 'sub_1', startDate: '2026-01-10', billingDay: 10, billingCycle: 'monthly', ...over,
})

const charge = (date: string, over: Partial<Expense> = {}): Expense =>
  ({ id: `e_${date}`, date, linkedSubscriptionId: 'sub_1', ...over }) as Expense

const win = (s: Sub, ref: string) => {
  const { start, end } = cycleWindow(s, new Date(ref))
  return [format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')]
}

describe('cycleWindow', () => {
  it('spans this charge date to the next', () => {
    expect(win(sub(), '2026-07-15')).toEqual(['2026-07-10', '2026-08-10'])
  })

  it('is the previous cycle on the day before the charge', () => {
    expect(win(sub(), '2026-07-09')).toEqual(['2026-06-10', '2026-07-10'])
  })

  it('rolls on the charge date itself — the new cycle opens that day', () => {
    expect(win(sub(), '2026-07-10')).toEqual(['2026-07-10', '2026-08-10'])
  })

  it('runs from the start date up to the first charge', () => {
    expect(win(sub({ startDate: '2026-07-01', billingDay: 15 }), '2026-07-05'))
      .toEqual(['2026-07-01', '2026-07-15'])
  })

  it('clamps a billing day past the end of a short month', () => {
    // Billed on the 31st: February bills on the 28th.
    expect(win(sub({ startDate: '2026-01-31', billingDay: 31 }), '2026-02-10'))
      .toEqual(['2026-01-31', '2026-02-28'])
  })

  it('handles weekly', () => {
    expect(win(sub({ startDate: '2026-07-01', billingCycle: 'weekly' }), '2026-07-10'))
      .toEqual(['2026-07-08', '2026-07-15'])
  })

  it('handles quarterly', () => {
    expect(win(sub({ startDate: '2026-01-10', billingCycle: 'quarterly' }), '2026-05-01'))
      .toEqual(['2026-04-10', '2026-07-10'])
  })

  it('handles yearly', () => {
    expect(win(sub({ startDate: '2024-03-05', billingDay: 5, billingCycle: 'yearly' }), '2026-07-15'))
      .toEqual(['2026-03-05', '2027-03-05'])
  })
})

describe('isCyclePaid', () => {
  const ref = new Date('2026-07-15')

  it('is paid when this cycle has a linked charge', () => {
    expect(isCyclePaid(sub(), [charge('2026-07-10')], ref)).toBe(true)
  })

  it('is NOT paid when the only charge belongs to the previous cycle', () => {
    expect(isCyclePaid(sub(), [charge('2026-06-10')], ref)).toBe(false)
  })

  it('is not paid with no charges at all', () => {
    expect(isCyclePaid(sub(), [], ref)).toBe(false)
  })

  it('ignores a charge linked to a different subscription', () => {
    expect(isCyclePaid(sub(), [charge('2026-07-10', { linkedSubscriptionId: 'sub_other' })], ref)).toBe(false)
  })

  it('ignores an unlinked charge', () => {
    expect(isCyclePaid(sub(), [charge('2026-07-10', { linkedSubscriptionId: undefined })], ref)).toBe(false)
  })

  it.each(['refunded', 'declined'] as const)('does not count a %s charge — it paid for nothing', (refundKind) => {
    expect(isCyclePaid(sub(), [charge('2026-07-10', { refundKind })], ref)).toBe(false)
  })

  it('excludes the next cycle boundary — a charge on the next billing date opens that cycle', () => {
    expect(isCyclePaid(sub(), [charge('2026-08-10')], ref)).toBe(false)
  })

  it('is unpaid before the first charge ever lands', () => {
    expect(isCyclePaid(sub({ startDate: '2026-07-01', billingDay: 25 }), [], new Date('2026-07-05'))).toBe(false)
  })

  it('does not throw on a future-dated start — returns unpaid instead of an inverted interval', () => {
    // A future start makes cycleWindow return end === start; subMilliseconds would invert
    // the interval and crash date-fns isWithinInterval, taking down the card render.
    const future = sub({ startDate: '2027-01-01', billingCycle: 'weekly' })
    expect(() => isCyclePaid(future, [], new Date('2026-07-15'))).not.toThrow()
    expect(isCyclePaid(future, [], new Date('2026-07-15'))).toBe(false)
  })
})
