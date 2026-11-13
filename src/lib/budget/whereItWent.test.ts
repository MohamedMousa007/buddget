import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/store/types'
import { whereItWent } from './whereItWent'

const ex = (description: string, amount: number, extra: Partial<Expense> = {}): Expense =>
  ({ id: description + amount, date: '2026-11-10', description, category: 'Groceries', amount, currency: 'EGP', amountInBaseCurrency: amount, ...extra }) as Expense

const names = new Set(['Groceries', 'Dining'])
const start = new Date('2026-11-01')
const end = new Date('2026-11-30')

describe('whereItWent', () => {
  it('groups by description ignoring case and spacing, biggest first, top three', () => {
    const rows = whereItWent(
      [ex('Carrefour', 500), ex(' carrefour ', 424), ex('Talabat', 626, { category: 'Dining' }), ex('Uber', 387), ex('Cafe  Nero', 100)],
      names, start, end,
    )
    expect(rows).toEqual([{ name: 'Carrefour', amount: 924 }, { name: 'Talabat', amount: 626 }, { name: 'Uber', amount: 387 }])
  })
  it('leaves out other categories, debt payments, refunds, other cycles and blank descriptions', () => {
    const rows = whereItWent(
      [
        ex('Rent', 5500, { category: 'Rent' }), ex('Visa', 700, { isDebtPayment: true }), ex('Refund', -50),
        ex('Old shop', 90, { date: '2026-10-20' }), ex('   ', 10), ex('Kept', 30),
      ],
      names, start, end,
    )
    expect(rows).toEqual([{ name: 'Kept', amount: 30 }])
  })
  it('is empty with nothing to show', () => {
    expect(whereItWent([], names, start, end)).toEqual([])
  })
})
