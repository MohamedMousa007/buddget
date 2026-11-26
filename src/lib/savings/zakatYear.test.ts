import { describe, expect, it } from 'vitest'
import { evaluateZakatYear, firstNisabDay, zakatBaseAt, zakatYearState, type ZakatSources } from './zakatYear'
import type { SavingsAccount, SavingsTransaction, ZakatConfig } from '@/lib/store/types'

// Silver nisab = 595 × 6000/85 = 42,000.
const lookup = ((key: string) => (key === 'XAU_24K' ? { price: 6000 } : null)) as never
const cfg: ZakatConfig = { nisabBasis: 'silver', nisabBasisChosen: true, holdsForTrading: false }
const ZAKAT_DATE = '2026-12-20' // year start 2025-12-31
const BEFORE = '2026-11-26'

const pocket = (id: string, currentBalance: number) =>
  ({ id, name: id, category: 'savings', type: 'other', currency: 'EGP', currentBalance, createdAt: '2025-01-01' }) as unknown as SavingsAccount
const tx = (accountId: string, type: 'deposit' | 'withdrawal', amount: number, date: string) =>
  ({ id: `${accountId}-${date}-${type}`, accountId, type, amount, currency: 'EGP', date }) as SavingsTransaction

const sources = (savingsAccounts: SavingsAccount[], savingsTransactions: SavingsTransaction[]): ZakatSources => ({
  ledger: {
    paymentMethods: [], expenses: [], incomeEvents: [], debtPayments: [], debts: [], adjustments: [],
    savingsAccounts, savingsTransactions, convert: (a) => a,
  },
  investmentHoldings: [], debts: [], debtPayments: [],
  baseCurrency: 'EGP', exchangeRates: {}, goldPricePerGram: 6000, goldPriceAvailable: true, lookup,
})

describe('zakat year reconstruction', () => {
  it('rolls a pocket back through its later transactions', () => {
    const src = sources([pocket('p', 60_000)], [tx('p', 'deposit', 50_000, '2025-06-01'), tx('p', 'deposit', 10_000, '2026-05-01')])
    expect(zakatBaseAt(src, cfg, '2025-12-31').cashAndSavings).toBe(50_000)
    expect(zakatBaseAt(src, cfg, '2026-05-01').cashAndSavings).toBe(60_000)
    expect(zakatBaseAt(src, cfg).cashAndSavings).toBe(60_000)
  })

  it('takes items with no history at today’s value and flags them', () => {
    const src = sources([pocket('p', 50_000), pocket('q', 5_000)], [tx('p', 'deposit', 50_000, '2025-06-01')])
    const base = zakatBaseAt(src, cfg, '2025-12-31')
    expect(base.cashAndSavings).toBe(55_000)
    expect(base.noHistoryCount).toBe(1)
    expect(evaluateZakatYear(src, cfg, ZAKAT_DATE, BEFORE).noHistoryCount).toBe(1)
  })
})

describe('zakat year due logic', () => {
  it('both ends above nisab: an estimate before the date, with the mid-year inflow counted', () => {
    const src = sources([pocket('p', 60_000)], [tx('p', 'deposit', 50_000, '2025-06-01'), tx('p', 'deposit', 10_000, '2026-05-01')])
    const y = evaluateZakatYear(src, cfg, ZAKAT_DATE, BEFORE)
    expect(y.yearStart).toBe('2025-12-31')
    expect(y.state).toBe('estimate')
    expect(y.result.zakat).toBeCloseTo(1_500, 5)
  })

  it('on or after the zakat date it is due now, on that date’s wealth', () => {
    const src = sources([pocket('p', 70_000)], [
      tx('p', 'deposit', 50_000, '2025-06-01'), tx('p', 'deposit', 10_000, '2026-05-01'), tx('p', 'deposit', 10_000, '2026-12-22'),
    ])
    const y = evaluateZakatYear(src, cfg, ZAKAT_DATE, '2026-12-25')
    expect(y.state).toBe('dueNow')
    expect(y.result.zakatable).toBe(60_000)
  })

  it('below nisab at the year start: not due yet, and finds the day wealth reached nisab', () => {
    const src = sources([pocket('p', 60_000)], [tx('p', 'deposit', 10_000, '2025-06-01'), tx('p', 'deposit', 50_000, '2026-05-01')])
    const y = evaluateZakatYear(src, cfg, ZAKAT_DATE, BEFORE)
    expect(y.state).toBe('notYet')
    expect(firstNisabDay(src, cfg, y.yearStart, BEFORE)).toBe('2026-05-01')
  })

  it('below nisab on the zakat date: not due', () => {
    const src = sources([pocket('p', 30_000)], [tx('p', 'deposit', 50_000, '2025-06-01'), tx('p', 'withdrawal', 20_000, '2026-05-01')])
    expect(evaluateZakatYear(src, cfg, ZAKAT_DATE, BEFORE).state).toBe('notDue')
  })

  it('a dip between the two ends does not matter', () => {
    const src = sources([pocket('p', 50_000)], [
      tx('p', 'deposit', 50_000, '2025-06-01'), tx('p', 'withdrawal', 45_000, '2026-03-01'), tx('p', 'deposit', 45_000, '2026-04-01'),
    ])
    expect(evaluateZakatYear(src, cfg, ZAKAT_DATE, BEFORE).state).toBe('estimate')
  })

  it('zakatYearState orders the checks', () => {
    const r = (zakatable: number, due = zakatable >= 100) => ({ zakatable, nisab: 100, nisabAvailable: true, due, zakat: 0, gap: 0 })
    expect(zakatYearState({ today: '2026-01-01', zakatDate: '2026-02-01', start: r(50), end: r(50) })).toBe('notDue')
    expect(zakatYearState({ today: '2026-01-01', zakatDate: '2026-02-01', start: r(50), end: r(150) })).toBe('notYet')
    expect(zakatYearState({ today: '2026-02-01', zakatDate: '2026-02-01', start: r(150), end: r(150) })).toBe('dueNow')
  })
})
