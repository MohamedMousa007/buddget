import { describe, expect, it } from 'vitest'
import { format, startOfDay } from 'date-fns'
import { getCurrentBillingCycleExpenses, getNextCreditCardDueDate } from '@/lib/debt/computeCreditCardBalance'
import { addCalendarDays } from '@/lib/time/calendarDays'
import { cardDue } from '@/lib/debt/cardDue'
import { bnplPlanDebt } from '@/lib/debts/bnplSplit'
import { nextInstallmentDueDate } from '@/lib/debts/installmentSchedule'
import type { Debt, Expense } from '@/lib/store/types'

const card = (day: number): Debt => ({
  id: 'cc', name: 'Card', person: '', startingBalance: 0, currency: 'EGP', isGold: false, debtType: 'credit_card',
  direction: 'i_owe', status: 'active', createdAt: '2026-01-01', paymentDueDay: day, linkedPaymentMethodId: 'pm', creditLimit: 10000,
})

describe('DEB-2: billing cycles tile the calendar in every zone', () => {
  it.each([1, 15, 24, 28, 29, 30, 31])('due day %i, 26 months, daily', (day) => {
    const d = card(day)
    let prevEnd: Date | null = null
    for (let ref = new Date(2026, 0, 1); ref < new Date(2028, 2, 1); ref = addCalendarDays(ref, 1)) {
      const c = getCurrentBillingCycleExpenses(d, [], {}, ref)
      expect(c.cycleStart <= startOfDay(ref) && startOfDay(ref) <= c.cycleEnd).toBe(true)
      expect(format(c.cycleEnd, 'yyyy-MM-dd')).toBe(getNextCreditCardDueDate(d, ref))
      if (prevEnd && c.cycleEnd.getTime() !== prevEnd.getTime()) {
        expect(c.cycleStart.getTime()).toBe(addCalendarDays(prevEnd, 1).getTime())
      }
      prevEnd = c.cycleEnd
    }
  })
  it('a charge on the first day of the cycle after the DST Friday is in that cycle', () => {
    const e = { id: 'e', date: '2027-05-01', description: '', category: 'Shopping', amount: 5, currency: 'EGP', paymentMethodId: 'pm', isRecurring: false, createdAt: '' } as Expense
    expect(getCurrentBillingCycleExpenses(card(30), [e], {}, new Date(2027, 4, 10)).expenses).toHaveLength(1)
  })
})

describe('DEB-5: card due after payments', () => {
  it('a card paid in full owes nothing', () => {
    expect(cardDue({ outstanding: 0, cycleCharges: 1000, installmentDue: 0 })).toEqual({ regularDue: 0, installmentDue: 0, allDue: 0, after: 0 })
  })
  it('a partial payment shrinks the due; the cycle charges cap it otherwise', () => {
    expect(cardDue({ outstanding: 600, cycleCharges: 1000, installmentDue: 0 }).regularDue).toBe(600)
    expect(cardDue({ outstanding: 1500, cycleCharges: 1000, installmentDue: 0 }).regularDue).toBe(1000)
  })
  it('installments add to what is due but are not taken off the outstanding', () => {
    expect(cardDue({ outstanding: 1500, cycleCharges: 1000, installmentDue: 200 })).toEqual({ regularDue: 1000, installmentDue: 200, allDue: 1200, after: 500 })
  })
})

describe('DEB-3: a split BNPL purchase', () => {
  it('starts the plan at the first instalment, so the next due is the reminder date, not the purchase date', () => {
    const debt = bnplPlanDebt({ title: 'TV', total: 1200, currency: 'EGP', provider: 'tabby', count: 4, perInstallment: 300, firstDue: '2026-12-01', paymentMethodId: 'pm' })
    expect(debt.startDate).toBe('2026-12-01')
    expect(format(nextInstallmentDueDate({ ...debt, id: 'd', createdAt: '' } as Debt, 0)!, 'yyyy-MM-dd')).toBe('2026-12-01')
    expect(format(nextInstallmentDueDate({ ...debt, id: 'd', createdAt: '' } as Debt, 1)!, 'yyyy-MM-dd')).toBe('2027-01-01')
  })
})
