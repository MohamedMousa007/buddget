import { describe, expect, it } from 'vitest'
import { addDays, format, parseISO } from 'date-fns'
import { evaluateZakatYear, firstNisabDay, zakatBaseAt, zakatResultAt, zakatYearState, type ZakatSources } from './zakatYear'
import { balancesOverTime, computeBalances } from '@/lib/accounts/balance'
import type { Debt, DebtPayment, Expense, IncomeEvent, InvestmentHolding, PaymentMethod, SavingsAccount, SavingsTransaction, ZakatConfig } from '@/lib/store/types'

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

describe('firstNisabDay single pass', () => {
  // A reference copy of the old scan: the ledger rebuilt from scratch on every day.
  const nextDay = (day: string) => format(addDays(parseISO(day), 1), 'yyyy-MM-dd')
  const oldFirstNisabDay = (src: ZakatSources, from: string, to: string): string | null => {
    const current = computeBalances(src.ledger)
    for (let i = 1, day = nextDay(from); i <= 385 && day <= to; i++, day = nextDay(day)) {
      const { result } = zakatResultAt(src, cfg, day, current)
      if (result.nisabAvailable && result.zakatable >= result.nisab) return day
    }
    return null
  }
  const bank = (id: string, openingBalance: number, openingAt: string, currency = 'EGP') =>
    ({ id, name: id, type: 'bank_account', currency, isDefault: false, openingBalance, openingAt }) as PaymentMethod
  const spend = (id: string, pm: string, amount: number, date: string, occurredAt?: string) =>
    ({ id, date, occurredAt, description: id, category: 'Shopping', amount, currency: 'EGP', amountInBaseCurrency: amount, paymentMethodId: pm, isRecurring: false, createdAt: '', updatedAt: '' }) as Expense
  const income = (id: string, pm: string, amount: number, receivedDate: string, currency = 'EGP') =>
    ({ id, paymentMethodId: pm, amount, currency, receivedDate, status: 'confirmed' }) as unknown as IncomeEvent
  const debt = { id: 'd1', name: 'Loan', person: 'Ali', currency: 'EGP', startingBalance: 8_000, direction: 'they_owe', status: 'active', debtType: 'personal', isGold: false, startDate: '2026-02-01', createdAt: '2026-02-01T00:00:00Z' } as unknown as Debt
  const payment = { id: 'dp1', debtId: 'd1', date: '2026-06-10', amountPaid: 3_000, currency: 'EGP', paymentMethodId: 'b1', originalAmount: 3_000, originalCurrency: 'EGP' } as unknown as DebtPayment
  const ring = { id: 'h1', assetType: 'gold', name: 'Ring', quantity: 2, currency: 'EGP', karat: 24, purchaseDate: '2026-07-15', createdAt: '', updatedAt: '' } as unknown as InvestmentHolding

  const fixture = (): ZakatSources => {
    const paymentMethods = [bank('b1', 20_000, '2025-11-01T00:00:00.000Z'), bank('b2', 5_000, '2026-04-10T09:00:00.000Z'), bank('usd', 100, '2025-10-01T00:00:00.000Z', 'USD')]
    const expenses = [
      spend('e1', 'b1', 4_000, '2026-01-20', '2026-01-20T08:30:00.000Z'),
      spend('e2', 'b1', 12_000, '2026-03-05'),
      spend('e3', 'b2', 1_000, '2026-04-10', '2026-04-10T08:00:00.000Z'), // before b2 opened: already inside its balance
      spend('e4', 'b1', 9_000, '2026-08-02', '2026-08-02T23:59:00.000Z'),
      spend('bad', 'b1', 250, 'not-a-date'),
    ]
    const incomeEvents = [income('i1', 'b1', 15_000, '2026-02-25'), income('i2', 'b1', 18_000, '2026-05-01'), income('i3', 'usd', 50, '2026-06-01', 'USD'), income('i4', 'b2', 7_500, '2026-09-15')]
    const ledger = {
      paymentMethods, expenses, incomeEvents, debtPayments: [payment], debts: [debt], adjustments: [],
      savingsAccounts: [pocket('p', 9_000)], savingsTransactions: [tx('p', 'deposit', 3_000, '2025-08-01'), tx('p', 'deposit', 6_000, '2026-06-20')],
      convert: (a: number, from: string, to: string) => (from === to ? a : from === 'USD' && to === 'EGP' ? a * 50 : to === 'USD' && from === 'EGP' ? a / 50 : null),
    }
    return {
      ledger, investmentHoldings: [ring], debts: [debt], debtPayments: [payment],
      baseCurrency: 'EGP', exchangeRates: { USD: 50 }, goldPricePerGram: 6000, goldPriceAvailable: true, lookup,
    }
  }

  it('reads the same balances off one walk as a full rebuild, at every instant', () => {
    const src = fixture()
    const at = balancesOverTime(src.ledger)
    for (let day = '2025-09-30'; day <= '2026-10-01'; day = nextDay(day)) {
      for (const t of [`${day}T00:00:00.000`, `${day}T12:00:00.000`, `${day}T23:59:59.999`]) {
        const ms = new Date(t).getTime()
        const full = computeBalances(src.ledger, ms)
        const fast = at(ms)
        expect([...fast.keys()].sort()).toEqual([...full.keys()].sort())
        for (const [id, b] of full) expect(fast.get(id)).toEqual({ balance: b.balance, currency: b.currency })
      }
    }
  })

  it('finds the same day as the old day-by-day rebuild, including no day at all', () => {
    const src = fixture()
    const ranges: [string, string][] = [['2025-10-01', '2026-10-01'], ['2026-03-05', '2026-10-01'], ['2026-05-02', '2026-10-01'], ['2026-08-03', '2026-09-10'], ['2026-09-30', '2026-09-30']]
    const found = ranges.map(([from, to]) => firstNisabDay(src, cfg, from, to))
    expect(found).toEqual(ranges.map(([from, to]) => oldFirstNisabDay(src, from, to)))
    expect(found[4]).toBeNull()
  })

  it('gives the same zakat figures on every day with the one walk as with a rebuild', () => {
    const src = fixture()
    const current = computeBalances(src.ledger)
    const history = balancesOverTime(src.ledger)
    for (let day = '2025-10-01'; day <= '2026-10-01'; day = nextDay(day)) {
      expect(zakatResultAt(src, cfg, day, current, history)).toEqual(zakatResultAt(src, cfg, day, current))
    }
  })

  it('finds the day wealth first reached nisab when an account balance carries it there', () => {
    const src = sources([], [])
    src.ledger = { ...src.ledger, paymentMethods: [bank('b1', 10_000, '2025-01-01T00:00:00.000Z')], incomeEvents: [income('i1', 'b1', 40_000, '2026-03-10')], expenses: [spend('e1', 'b1', 30_000, '2026-04-01')] }
    expect(firstNisabDay(src, cfg, '2025-12-31', '2026-11-26')).toBe('2026-03-10')
    expect(firstNisabDay(src, cfg, '2026-04-01', '2026-11-26')).toBeNull()
  })
})
