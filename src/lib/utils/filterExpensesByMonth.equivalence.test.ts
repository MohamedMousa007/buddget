import { isWithinInterval, parseISO, format, addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { filterExpensesByMonth, filterExpensesByRange, getMonthRange } from './calculations'
import type { Expense } from '@/lib/store/types'

function legacy(expenses: Expense[], monthStr: string, monthStartDay: number): Expense[] {
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  return expenses.filter((e) => isWithinInterval(parseISO(e.date), { start, end }))
}

let seed = 42
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('filterExpensesByMonth key compare', () => {
  const base = new Date(2025, 0, 1)
  const expenses = Array.from({ length: 4000 }, (_, i) => ({
    id: String(i),
    date: format(addDays(base, Math.floor(rand() * 900)), 'yyyy-MM-dd'),
  })) as unknown as Expense[]

  it('matches the date-fns implementation on a randomized fixture', () => {
    for (const startDay of [1, 5, 15, 28, 31]) {
      for (let m = 0; m < 28; m++) {
        const d = new Date(2025, m, 1)
        const key = format(d, 'yyyy-MM')
        expect(filterExpensesByMonth(expenses, key, startDay).map((e) => e.id)).toEqual(
          legacy(expenses, key, startDay).map((e) => e.id),
        )
      }
    }
  }, 30000)

  it('includes both boundary days of an arbitrary range', () => {
    const range = { start: new Date(2025, 2, 10), end: new Date(2025, 2, 12, 23, 59, 59, 999) }
    const rows = ['2025-03-09', '2025-03-10', '2025-03-12', '2025-03-13'].map((date) => ({ date })) as Expense[]
    expect(filterExpensesByRange(rows, range).map((e) => e.date)).toEqual(['2025-03-10', '2025-03-12'])
  })
})
