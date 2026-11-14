import { describe, expect, it } from 'vitest'
import type { Expense, IncomeEvent } from '@/lib/store/types'
import { firstOpenFlag, refundCandidates, selectFlagPrompts } from './flagPrompts'

const exp = (id: string, date: string, extra: Partial<Expense> = {}): Expense =>
  ({ id, date, description: 'x', category: 'Food', amount: 100, currency: 'EGP', paymentMethodId: 'p', ...extra }) as Expense
const inc = (id: string, receivedDate: string, extra: Partial<IncomeEvent> = {}): IncomeEvent =>
  ({ id, receivedDate, name: 'x', amount: 100, currency: 'EGP', status: 'confirmed', ...extra }) as IncomeEvent

describe('selectFlagPrompts (I8: a prompt is shown only for an open server flag)', () => {
  it('skips acknowledged flags and rows without flags', () => {
    const out = selectFlagPrompts([exp('a', '2026-11-01', { smsFlags: ['date_unsure'], smsFlagsAck: ['date_unsure'] }), exp('b', '2026-11-02')], [])
    expect(out).toEqual([])
  })
  it('emits one target per open flag of a row', () => {
    const out = selectFlagPrompts([exp('a', '2026-11-01', { smsFlags: ['date_unsure', 'possible_duplicate'] })], [])
    expect(out.map((t) => t.flag)).toEqual(['possible_duplicate', 'date_unsure'])
  })
  it('caps at the 3 most recent rows across expenses and income', () => {
    const e = ['01', '02', '03'].map((d) => exp(`e${d}`, `2026-11-${d}`, { smsFlags: ['date_unsure'] }))
    const i = inc('i04', '2026-11-04', { smsFlags: ['date_unsure'] })
    expect(selectFlagPrompts(e, [i]).map((t) => t.id)).toEqual(['i04', 'e03', 'e02'])
  })
  it('ignores a flag that has no answer on that kind of row', () => {
    expect(selectFlagPrompts([], [inc('i', '2026-11-01', { smsFlags: ['cash_deposit'] })])).toEqual([])
    expect(selectFlagPrompts([exp('a', '2026-11-01', { smsFlags: ['cash_deposit'] })], []).map((t) => t.flag)).toEqual(['cash_deposit'])
    expect(selectFlagPrompts([], [inc('i', '2026-11-01', { smsFlags: ['refund_unmatched'] })])).toEqual([])
  })
  it('is pure: the rows are not changed', () => {
    const e = exp('a', '2026-11-01', { smsFlags: ['date_unsure'] })
    const before = JSON.stringify(e)
    selectFlagPrompts([e], [])
    expect(JSON.stringify(e)).toBe(before)
  })
})

describe('firstOpenFlag', () => {
  it('names the first open flag only', () => {
    expect(firstOpenFlag(exp('a', '2026-11-01', { smsFlags: ['date_unsure', 'possible_duplicate'], smsFlagsAck: ['possible_duplicate'] }), 'expense')).toBe('date_unsure')
    expect(firstOpenFlag(exp('a', '2026-11-01'), 'expense')).toBeNull()
  })
})

describe('refundCandidates (refund pick is exact-amount, same-currency, 180 days)', () => {
  const refund = { id: 'r', amount: 250, currency: 'EGP' as const, date: '2026-11-10' }
  const ids = (list: Expense[]) => refundCandidates(list, refund).map((e) => e.id)
  it('keeps only the exact amount in the same currency', () => {
    expect(ids([exp('ok', '2026-11-05', { amount: 250 }), exp('amt', '2026-11-05', { amount: 249.99 }), exp('cur', '2026-11-05', { amount: 250, currency: 'USD' })])).toEqual(['ok'])
  })
  it('windows to 180 days before and 2 days after the refund date', () => {
    const list = [
      exp('old', '2026-05-13', { amount: 250 }),
      exp('edge', '2026-05-14', { amount: 250 }),
      exp('soon', '2026-11-12', { amount: 250 }),
      exp('late', '2026-11-13', { amount: 250 }),
    ]
    expect(ids(list)).toEqual(['soon', 'edge'])
  })
  it('excludes refunded, declined and the placeholder itself, and lists newest first', () => {
    const list = [
      exp('r', '2026-11-10', { amount: 250 }),
      exp('done', '2026-11-04', { amount: 250, refundedAt: '2026-11-06', refundKind: 'refunded' }),
      exp('a', '2026-11-01', { amount: 250 }),
      exp('b', '2026-11-08', { amount: 250 }),
    ]
    expect(ids(list)).toEqual(['b', 'a'])
  })
})
