import { describe, it, expect } from 'vitest'
import { cycleCarryFigures, type CycleCarryInput } from './cycleCarryFigures'
import type { Expense, IncomeEvent, IncomeSource } from '@/lib/store/types'

const rates = { USD_EGP: 50 }
const exp = (o: Partial<Expense>) =>
  ({ id: 'e', category: 'Food', amount: 100, currency: 'EGP', amountInBaseCurrency: 100, date: '2026-07-10', ...o }) as Expense
const ev = (o: Partial<IncomeEvent>) =>
  ({ id: 'i', name: 'Pay', amount: 1000, currency: 'EGP', receivedDate: '2026-07-05', status: 'confirmed', updatedAt: '', ...o }) as IncomeEvent

const base = (o: Partial<CycleCarryInput> = {}): CycleCarryInput => ({
  monthKey: '2026-07', monthStartDay: 1, base: 'EGP', rates,
  expenses: [], incomeEvents: [], incomeSources: [], deposits: [], ...o,
})

describe('cycleCarryFigures', () => {
  it('counts spend, excludes non-spend rows and refunds', () => {
    const f = cycleCarryFigures(base({
      expenses: [
        exp({ amount: 100 }),
        exp({ category: 'ATM Cash Withdrawal', amount: 300 } as Partial<Expense>),
        exp({ amount: 50, spendExclusion: 'manual' } as Partial<Expense>),
        exp({ amount: 70, refundKind: 'refunded' } as Partial<Expense>),
      ],
    }))!
    expect(f.spend).toBe(100)
  })
  it('savings-tagged expenses and cash-flow deposits are allocated; carry deposits are not', () => {
    const f = cycleCarryFigures(base({
      expenses: [exp({ category: 'Savings', amount: 200 })],
      deposits: [
        { amount: 100, currency: 'EGP', kind: 'deposit', isCashFlow: true, source: null },
        { amount: 999, currency: 'EGP', kind: 'deposit', isCashFlow: true, source: 'carry' },
        { amount: 999, currency: 'EGP', kind: 'deposit', isCashFlow: false, source: null },
      ],
    }))!
    expect(f.allocated).toBe(300)
  })
  it('income is realized events only for a one-time event', () => {
    const f = cycleCarryFigures(base({ incomeEvents: [ev({ amount: 1000 }), ev({ id: 'j', status: 'missed' })] }))!
    expect(f.income).toBe(1000)
  })
  it('income falls back to the projection for a recurring template without events', () => {
    const t = {
      id: 't', name: 'Salary', amount: 5000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly',
      dayOfMonth: 25, createdAt: '2026-01-01T00:00:00Z', effectiveStart: '2026-01-01',
    } as IncomeSource
    expect(cycleCarryFigures(base({ incomeSources: [t] }))!.income).toBe(5000)
  })
  it('converts foreign currency with the live rates', () => {
    expect(cycleCarryFigures(base({ expenses: [exp({ currency: 'USD', amount: 2 })] }))!.spend).toBe(100)
  })
  it('a deposit that is not counted (carry sweep, non-cash-flow) in an unconvertible currency does not block', () => {
    const f = cycleCarryFigures(base({
      deposits: [
        { amount: 1, currency: 'BTC', kind: 'deposit', isCashFlow: false, source: null },
        { amount: 1, currency: 'BTC', kind: 'deposit', isCashFlow: true, source: 'carry' },
      ],
    }))
    expect(f).not.toBeNull()
  })
  it('returns null when a currency cannot be converted, instead of posting wrong money', () => {
    expect(cycleCarryFigures(base({ expenses: [exp({ currency: 'KWD' })], rates: {} }))).toBeNull()
    expect(cycleCarryFigures(base({ extraCurrencies: ['BTC'], rates: {} }))).toBeNull()
  })
})
