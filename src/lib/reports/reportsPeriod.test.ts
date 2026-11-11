import { describe, expect, it } from 'vitest'
import { isReportSpendRow, reportCycles, reportRange, reportSpendRows } from './reportsPeriod'
import type { Expense } from '@/lib/store/types'

const NOW = new Date(2026, 9, 28)

describe('reportRange', () => {
  it('uses the budget cycle, not the calendar month, when monthStartDay > 1', () => {
    const { start, end } = reportRange('thisMonth', NOW, 25)
    expect(start).toEqual(new Date(2026, 9, 25))
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(10)
    expect(end.getDate()).toBe(24)
  })

  it('before the start day the current cycle began last month', () => {
    const { start } = reportRange('thisMonth', new Date(2026, 9, 10), 25)
    expect(start).toEqual(new Date(2026, 8, 25))
  })

  it('last3Months spans three cycles ending with the current one', () => {
    expect(reportCycles('last3Months', NOW, 25)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(reportRange('last3Months', NOW, 25).start).toEqual(new Date(2026, 7, 25))
  })

  it('startDay 1 keeps calendar months', () => {
    expect(reportRange('lastMonth', NOW, 1).start).toEqual(new Date(2026, 8, 1))
    expect(reportCycles('thisYear', NOW, 1)).toHaveLength(10)
  })
})

describe('reportSpendRows', () => {
  const e = (over: Partial<Expense>): Expense =>
    ({ id: 'x', date: '2026-10-05', amount: 10, currency: 'EGP', category: 'Food', description: 'd', ...over }) as Expense

  it('drops transfers, ATM, CC payoff, top-up, savings and excluded rows', () => {
    const rows = [
      e({ id: '1' }),
      e({ id: '2', category: 'Transfer' }),
      e({ id: '3', category: 'ATM Cash Withdrawal' }),
      e({ id: '4', category: 'CC Payoff' }),
      e({ id: '5', category: 'Top up' }),
      e({ id: '6', category: 'Savings' }),
      e({ id: '7', spendExclusion: 'user' as never }),
    ]
    expect(reportSpendRows(rows).map((r) => r.id)).toEqual(['1'])
  })

  it('drops refunded and declined rows (RPW-3): they are neither purchases nor a biggest purchase', () => {
    const rows = [e({ id: '1' }), e({ id: '2', refundKind: 'refunded' }), e({ id: '3', refundKind: 'declined' })]
    expect(reportSpendRows(rows).map((r) => r.id)).toEqual(['1'])
    expect(isReportSpendRow(rows[1])).toBe(false)
  })
})

describe('thisYear with a late cycle start (RPW-9)', () => {
  it('before the first cycle of the year begins, only the running cycle is shown', () => {
    expect(reportCycles('thisYear', new Date(2026, 0, 10), 25)).toEqual(['2025-12'])
    expect(reportCycles('thisYear', new Date(2026, 0, 24), 25)).toEqual(['2025-12'])
  })

  it('from the first cycle start on, it is the cycles starting this year', () => {
    expect(reportCycles('thisYear', new Date(2026, 0, 25), 25)).toEqual(['2026-01'])
    expect(reportCycles('thisYear', new Date(2026, 2, 3), 25)).toEqual(['2026-01', '2026-02'])
  })

  it('start day 1 is unchanged on Jan 1', () => {
    expect(reportCycles('thisYear', new Date(2026, 0, 1), 1)).toEqual(['2026-01'])
  })
})
