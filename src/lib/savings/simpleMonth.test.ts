import { describe, expect, it } from 'vitest'
import { SIMPLE_MONTH_DEFAULT_OFF, simpleMonthDebts, simpleMonthSum, type SimpleMonth } from './simpleMonth'
import type { Debt } from '@/lib/store/types'

const month: SimpleMonth = { rent: 7000, food: 2800, transport: 900, bills: 1300, debtMinimums: 4650, total: 16650 }

describe('simpleMonthSum', () => {
  it('counts every line by default', () => {
    expect(simpleMonthSum(month, new Set())).toBe(16650)
  })
  it('leaves out the lines turned off', () => {
    expect(simpleMonthSum(month, new Set(['debtMinimums']))).toBe(12000)
  })
  it('starts with debt minimums left out, as the mockup shows (12,000 of 16,650)', () => {
    expect([...SIMPLE_MONTH_DEFAULT_OFF]).toEqual(['debtMinimums'])
    expect(simpleMonthSum(month, SIMPLE_MONTH_DEFAULT_OFF)).toBe(12000)
  })
})

describe('simpleMonthDebts', () => {
  const debt = (name: string, installmentAmount: number | null) => ({ name, installmentAmount, currency: 'EGP' }) as unknown as Debt
  it('lists debts with an instalment, largest first, in base currency', () => {
    const rows = simpleMonthDebts([debt('valU', 1400), debt('Car loan', 3250), debt('Ahmed', null)], 'EGP' as never, { EGP: 1 })
    expect(rows).toEqual([{ name: 'Car loan', amount: 3250 }, { name: 'valU', amount: 1400 }])
  })
})
