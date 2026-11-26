import { describe, expect, it } from 'vitest'
import { debtOutlook, debtSchedule, owedDebtOverdue, type DebtScheduleCtx } from '@/lib/debts/debtSchedule'
import type { Debt, RecurringDebtPayment } from '@/lib/store/types'

// The QA case: 23,400 owed, the payment due Oct 26 not made, today Nov 26 2026 (local dates, TZ-proof).
const now = new Date(2026, 10, 26, 12)
const cycleEnd = new Date(2026, 10, 30, 23, 59)
const debt = (over: Partial<Debt> = {}): Debt => ({
  id: 'd1', name: '', person: 'Ahmed', personName: 'Ahmed', startingBalance: 23400, currency: 'EGP', isGold: false,
  debtType: 'personal', direction: 'i_owe', status: 'active', createdAt: '2026-09-26', ...over,
})
const plan = (nextDueDate: string, amount = 23400): RecurringDebtPayment => ({
  id: 'r1', debtId: 'd1', amount, currency: 'EGP', paymentMethodId: 'cash', frequency: 'monthly', nextDueDate, isActive: true, createdAt: '2026-09-26',
})
const ctx = (recurring: RecurringDebtPayment[]): DebtScheduleCtx => ({
  payments: [], recurring, remaining: (d) => d.startingBalance, toBase: (a) => a,
})

describe('debt outlook around today', () => {
  it('reports an unpaid past payment as overdue, with no next payment and no debt-free date', () => {
    const { scheduled, ends } = debtSchedule([debt()], ctx([plan('2026-10-26')]), now)
    const o = debtOutlook(scheduled, ends, now, cycleEnd)
    expect(o.overdue?.amount).toBe(23400)
    expect(o.overdue?.since.getDate()).toBe(26)
    expect(o.overdue?.since.getMonth()).toBe(9)
    expect(o.next).toBeNull()
    expect(o.dueAhead).toBe(0)
    expect(o.debtFreeDate).toBeNull()
  })

  it('a payment due today is next, not overdue', () => {
    const { scheduled, ends } = debtSchedule([debt()], ctx([plan('2026-11-26')]), now)
    const o = debtOutlook(scheduled, ends, now, cycleEnd)
    expect(o.overdue).toBeNull()
    expect(o.next?.amount).toBe(23400)
    expect(o.dueAhead).toBe(23400)
    expect(o.debtFreeDate?.getMonth()).toBe(10)
  })

  it('projects the debt-free date from the real plan: 23,400 at 2,000 a month from Dec 5 ends Nov 2027', () => {
    const { scheduled, ends } = debtSchedule([debt()], ctx([plan('2026-12-05', 2000)]), now)
    const o = debtOutlook(scheduled, ends, now, cycleEnd)
    expect(o.next?.date.getMonth()).toBe(11)
    expect(o.debtFreeDate?.getFullYear()).toBe(2027)
    expect(o.debtFreeDate?.getMonth()).toBe(10)
  })

  it('never shows a payoff goal date that has passed', () => {
    const d = debt({ goal: { targetDate: '2026-10-01', paymentFrequency: 'monthly', calculatedAmount: 0 } })
    const { scheduled, ends } = debtSchedule([d], ctx([]), now)
    expect(debtOutlook(scheduled, ends, now, cycleEnd).debtFreeDate).toBeNull()
  })
})

describe('owedDebtOverdue (budget debt-free month)', () => {
  it('is true for an owed debt with a past unpaid payment', () => {
    expect(owedDebtOverdue([debt()], ctx([plan('2026-10-26')]), now)).toBe(true)
  })
  it('ignores money owed to the user and cleared debts', () => {
    expect(owedDebtOverdue([debt({ direction: 'they_owe' })], ctx([plan('2026-10-26')]), now)).toBe(false)
    expect(owedDebtOverdue([debt({ status: 'cleared' })], ctx([plan('2026-10-26')]), now)).toBe(false)
  })
  it('is false when the next payment is still ahead', () => {
    expect(owedDebtOverdue([debt()], ctx([plan('2026-12-05')]), now)).toBe(false)
  })
})
