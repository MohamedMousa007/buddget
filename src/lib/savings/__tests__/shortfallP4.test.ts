import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Debt, Expense, Goal, IncomeEvent, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeBalances, type LedgerInput } from '@/lib/accounts/balance'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { answerSetAsideMoney, closeAccount, heldIn, shortIn } from '@/lib/accounts/actions'
import { removePaymentMethod } from '@/lib/accounts/removePaymentMethod'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { coveredParts, planMove, planSpent, prefillDestination, shortOf, shortfallEpisodes } from '@/lib/savings/shortfall'
import { planMerge } from '@/lib/accounts/provisional'
import { buildAIActionHandlerContext, executeActionItem, validateActionItem } from '@/lib/ai/aiActionHandlers'
import { ACCOUNTS_LT_COPY } from '@/lib/i18n/accountsLtCopy'
import { netSavingsLedgerInBaseForMonth, totalDebtRemainingDetail } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'

/**
 * LOGIC_SPEC §6, P4 rows (T10–T16, N4; N3 waits for P6's Undo) on fixture F, read on Dec 3 2025 (local), when the CIB
 * card holds back 6,000 (16,000 owed − 10,000 of the TV plan not billed yet). Dates in 2025 as in the P1–P3 files.
 */
const RATES = { USD_EGP: 50, EGP_USD: 0.02 }
const RATES45 = { USD_EGP: 45, EGP_USD: 1 / 45 }
const GOLD = 4000
const OPEN = '2025-11-01T00:00:00.000Z'
const USER = '11111111-2222-4333-8444-555555555555'

const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2025-11-01', openingAt: OPEN, ...over }) as PaymentMethod
const part = (id: string, currentBalance: number, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'vault', currency: 'EGP', currentBalance, createdAt: '2025-11-01', ...over }) as SavingsAccount
const expense = (id: string, amount: number, paymentMethodId: string, date: string, over: Partial<Expense> = {}): Expense =>
  ({ id, amount, currency: 'EGP', category: 'Food', description: id, date, paymentMethodId, isRecurring: false, createdAt: date, ...over }) as Expense
const income = (id: string, amount: number, currency: string, paymentMethodId: string, receivedDate: string): IncomeEvent =>
  ({ id, amount, currency, paymentMethodId, receivedDate, status: 'confirmed', createdAt: receivedDate }) as unknown as IncomeEvent
const goal = (id: string, target: number, priority: number, linked: string[]): Goal =>
  ({ id, name: id, category: 'quality_of_life', currency: 'EGP', targetAmount: target, priority, status: 'active', linkedSavingsAccountIds: linked, linkedDebtIds: [], manualCurrentAmount: 0, fundingMode: 'share', createdAt: '2025-11-01' }) as unknown as Goal
const debt = (id: string, over: Partial<Debt>): Debt =>
  ({ id, name: id, person: '', startingBalance: 0, currency: 'EGP', isGold: false, direction: 'i_owe', status: 'active', createdAt: '2025-11-01', ...over }) as Debt

const CARD = debt('cardDebt', { debtType: 'credit_card', linkedPaymentMethodId: 'card', paymentDueDay: 10 })
const TV = debt('tv', {
  name: 'TV', person: 'Installment', debtType: 'installment', startingBalance: 12000, installmentCount: 6, installmentAmount: 2000,
  installmentFrequency: 'monthly', startDate: '2025-12-10', installmentProvider: 'credit_card', linkedCreditCardDebtId: 'cardDebt', createdAt: '2025-11-12',
})

function seedF(rates: Record<string, number> = RATES) {
  useFinanceStore.setState({
    paymentMethods: [
      pm('CIB', { openingBalance: 60000 }),
      pm('Deel', { type: 'wallet', currency: 'USD', openingBalance: 700 }),
      pm('Cash', { type: 'cash', openingBalance: 3000 }),
      pm('NBE', { openingBalance: 0 }),
      pm('card', { type: 'credit_card', parentId: 'CIB', openingAt: undefined }),
    ],
    expenses: [
      expense('debit', 20000, 'CIB', '2025-11-10'),
      expense('cashSpend', 1000, 'Cash', '2025-11-12'),
      expense('cardBuys', 4000, 'card', '2025-11-20'),
      expense('tvBuy', 12000, 'card', '2025-11-12'),
    ],
    incomeEvents: [income('salary', 60000, 'EGP', 'CIB', '2025-11-25'), income('freelance', 300, 'USD', 'Deel', '2025-11-20')],
    debts: [CARD, TV],
    debtPayments: [],
    savingsAccounts: [
      part('carCIB', 20000, { heldInPaymentMethodId: 'CIB', goalId: 'car' }),
      part('carDeel', 200, { currency: 'USD', heldInPaymentMethodId: 'Deel', goalId: 'car' }),
      part('travel', 5000, { heldInPaymentMethodId: 'CIB' }),
      part('ms', 3000, { heldInPaymentMethodId: 'CIB', isMonthlySavings: true }),
      part('wedding', 8.75, { currency: 'XAU', goalId: 'wedding' }),
    ],
    savingsTransactions: [],
    accountAdjustments: [],
    goals: [goal('car', 150000, 1, ['carCIB', 'carDeel']), goal('wedding', 50000, 3, ['wedding'])],
    recurringSavingsDeposits: [],
    recurringDebtPayments: [],
    subscriptions: [],
    incomeSources: [],
    exchangeRates: rates,
    goldPricePerGram: GOLD,
    goldPriceAvailable: true,
    profile: { ...useFinanceStore.getState().profile, id: USER, defaultCarryPocketId: null },
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP', monthStartDay: 1 },
  })
}

const S = () => useFinanceStore.getState()
const ledger = (rates: Record<string, number> = S().exchangeRates): LedgerInput => {
  const s = S()
  return {
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debts: s.debts, debtPayments: s.debtPayments,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments,
    convert: (a, from, to) => tryConvertCurrency(a, from, to, rates),
  }
}
const bal = (id: string) => {
  const b = computeBalances(ledger()).get(id)!
  return { balance: b.balance, held: b.held, free: b.free }
}
const netWorth = (rates: Record<string, number> = S().exchangeRates) => {
  const s = S()
  const basis = accountsBasisFor(ledger(rates), 'EGP')
  const debtRemaining = totalDebtRemainingDetail(s.debts, s.debtPayments, 'EGP', rates, GOLD, true, s.expenses).total
  return computeNetWorth({
    ...basis, savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: s.debts,
    settings: { baseCurrency: 'EGP', secondaryCurrency: null, showSecondaryCurrency: false } as never,
    exchangeRates: rates, goldPricePerGram: GOLD, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining,
  }).netWorth
}
/** Car progress from covered parts (§4.5, P5 reads it): what each part's account still holds, in EGP. */
const carProgress = (rates: Record<string, number> = S().exchangeRates) => {
  const cov = coveredParts(ledger(rates), S().goals)
  return S().savingsAccounts.filter((p) => p.goalId === 'car')
    .reduce((n, p) => n + (tryConvertCurrency(cov.get(p.id) ?? 0, p.currency, 'EGP', rates) ?? 0), 0)
}
const debitCIB = (amount: number, id = 'dec1', date = '2025-12-01', over: Partial<Expense> = {}) =>
  useFinanceStore.setState((s) => ({ expenses: [...s.expenses, expense(id, amount, 'CIB', date, over)] }))
const part$ = (id: string) => S().savingsAccounts.find((p) => p.id === id)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2025, 11, 3, 12))
  seedF()
})
afterEach(() => vi.useRealTimers())

describe('T10: uncover order', () => {
  it('T1 state: MS 3,000 and Travel 5,000 uncovered, Car covered; one notice', () => {
    debitCIB(80000)
    expect(bal('CIB')).toEqual({ balance: 20000, held: 28000, free: -14000 })
    expect(shortOf(ledger(), 'CIB')).toBe(8000)
    const cov = coveredParts(ledger(), S().goals)
    expect([cov.get('ms'), cov.get('travel'), cov.get('carCIB'), cov.get('wedding')]).toEqual([0, 0, 20000, 8.75])
    expect(carProgress()).toBe(30000)
    const eps = shortfallEpisodes(ledger())
    expect(eps).toHaveLength(1)
    expect(eps[0]).toMatchObject({ accountId: 'CIB', short: 8000, openedAt: new Date('2025-12-01T12:00:00').getTime() })
    expect(ACCOUNTS_LT_COPY.en.short.line('8,000', 'CIB')).toBe("8,000 of what you set aside isn't in CIB anymore")
  })
})

describe('anchor-opened episode', () => {
  it('a lower bank balance (anchor) opens the episode at the anchor', () => {
    const at = '2025-12-02T09:00:00.000Z'
    useFinanceStore.setState({ accountAdjustments: [{ id: 'k', paymentMethodId: 'CIB', delta: -75000, anchorBalance: 25000, reason: 'manual_update', occurredAt: at, createdAt: at, updatedAt: at }] })
    expect(shortfallEpisodes(ledger())).toEqual([expect.objectContaining({ accountId: 'CIB', short: 3000, openedAt: new Date(at).getTime() })])
  })
})

describe('T11: deeper short', () => {
  it('CIB debit −82,000: short 10,000; Car CIB covered 18,000; Car 28,000 (18.7%)', () => {
    debitCIB(82000)
    expect(shortOf(ledger(), 'CIB')).toBe(10000)
    expect(coveredParts(ledger(), S().goals).get('carCIB')).toBe(18000)
    expect(carProgress()).toBe(28000)
    expect(Math.round((carProgress() / 150000) * 1000) / 10).toBe(18.7)
  })
  it('a second drop deepens the same episode (same key, no new notice)', () => {
    debitCIB(80000)
    const key = shortfallEpisodes(ledger())[0].key
    debitCIB(2000, 'dec2', '2025-12-02')
    expect(shortfallEpisodes(ledger()).map((e) => [e.key, e.short])).toEqual([[key, 10000]])
  })
})

describe('T12: it is in another account', () => {
  it('own transfer CIB→NBE 80,000; NBE pre-filled; MS moves as an amount, Travel as a whole pocket', () => {
    debitCIB(80000, 'xfer', '2025-12-01', { category: 'Transfer', toPaymentMethodId: 'NBE' })
    expect(prefillDestination(ledger(), 'CIB')).toMatchObject({ accountId: 'NBE', amount: 80000 })
    expect(answerSetAsideMoney('CIB', { kind: 'move', toId: 'NBE' }, shortIn('CIB'))).toBe(0)
    const labels = S().savingsTransactions.map((t) => [t.source, t.accountId === 'ms' ? 'ms' : part$(t.accountId)?.heldInPaymentMethodId ?? t.accountId, t.amount])
    expect(labels).toEqual([['move_out', 'ms', 3000], ['move_in', 'NBE', 3000], ['move_in', 'NBE', 5000]])
    expect(part$('travel')).toBeUndefined()
    expect(S().savingsAccounts.find((p) => p.name === 'travel')).toMatchObject({ heldInPaymentMethodId: 'NBE', currentBalance: 5000 })
    expect(bal('CIB')).toEqual({ balance: 20000, held: 20000, free: -6000 })
    expect(bal('NBE')).toEqual({ balance: 80000, held: 8000, free: 72000 })
    expect(shortOf(ledger(), 'CIB')).toBe(0)
    expect(shortfallEpisodes(ledger())).toEqual([])
    expect(netWorth()).toBe(171000)
  })
})

describe('T13: I spent it', () => {
  it('T1 state: spent MS 3,000 + Travel 5,000; held 20,000; free −6,000; savedNet(Dec) −8,000', () => {
    debitCIB(80000)
    expect(answerSetAsideMoney('CIB', { kind: 'spent' }, shortIn('CIB'))).toBe(0)
    expect(S().savingsTransactions.map((t) => [t.source, t.accountId, t.amount])).toEqual([['spent', 'ms', 3000], ['spent', 'travel', 5000]])
    expect(bal('CIB')).toEqual({ balance: 20000, held: 20000, free: -6000 })
    expect(shortfallEpisodes(ledger())).toEqual([])
    expect(netSavingsLedgerInBaseForMonth(S().savingsTransactions, '2025-12', 1, 'EGP', RATES, { pricePerGram: GOLD, available: true })).toBe(-8000)
  })
})

describe('T14: FX only', () => {
  it('rate 45: no shortfall; Car 29,000; free Deel 36,000 EGP; NW 166,000', () => {
    useFinanceStore.setState({ exchangeRates: RATES45 })
    expect(shortfallEpisodes(ledger())).toEqual([])
    expect(['CIB', 'Deel', 'Cash', 'NBE'].map((id) => shortOf(ledger(), id))).toEqual([0, 0, 0, 0])
    expect(carProgress()).toBe(29000)
    expect(tryConvertCurrency(bal('Deel').free, 'USD', 'EGP', RATES45)).toBe(36000)
    expect(netWorth()).toBe(166000)
  })
  it('a rate move on an old cross-currency row opens no episode (the row still reads Short X)', () => {
    useFinanceStore.setState((s) => ({
      paymentMethods: [...s.paymentMethods, pm('X', { openingBalance: 0 })],
      incomeEvents: [...s.incomeEvents, income('usdIn', 1000, 'USD', 'X', '2025-11-05')],
      savingsAccounts: [...s.savingsAccounts, part('xPocket', 48000, { heldInPaymentMethodId: 'X' })],
      savingsTransactions: [{ id: 'xs', accountId: 'xPocket', type: 'deposit', amount: 48000, currency: 'EGP', date: '2025-11-06', source: 'set_aside', isCashFlow: false }],
      exchangeRates: RATES45,
    }))
    expect(shortOf(ledger(), 'X')).toBe(3000)
    expect(shortfallEpisodes(ledger())).toEqual([])
  })
})

describe('T15: close with goal money', () => {
  it('T6 then close Deel, "In CIB" at the booked rate (rate now 45): Car CIB 30,000, Deel part 0 and hidden', () => {
    useFinanceStore.setState((s) => ({
      expenses: [...s.expenses, expense('xfer', 1000, 'Deel', '2025-12-01', { currency: 'USD', category: 'Transfer', toPaymentMethodId: 'CIB', toAccountAmount: 50000 })],
      exchangeRates: RATES45,
    }))
    expect(shortOf(ledger(), 'Deel')).toBe(200)
    expect(closeAccount('Deel')).toBe(false)
    expect(answerSetAsideMoney('Deel', { kind: 'move', toId: 'CIB' }, heldIn('Deel'))).toBe(0)
    expect(part$('carCIB')?.currentBalance).toBe(30000)
    expect(part$('carDeel')?.currentBalance).toBe(0)
    expect(heldIn('Deel')).toBe(0)
    expect(bal('CIB')).toEqual({ balance: 150000, held: 38000, free: 106000 })
    expect(closeAccount('Deel')).toBe(true)
    expect(S().paymentMethods.find((m) => m.id === 'Deel')?.closedAt).toBeTruthy()
    expect(netWorth()).toBe(171000)
  })
})

describe('T16: one guard for close and delete', () => {
  it('close Deel unanswered and delete Deel unanswered: both needs_answer, account unchanged', () => {
    const before = S().paymentMethods.find((m) => m.id === 'Deel')
    expect(removePaymentMethod(S(), 'Deel', 'close')).toBe('needs_answer')
    expect(removePaymentMethod(S(), 'Deel', 'auto')).toBe('needs_answer')
    expect(closeAccount('Deel')).toBe(false)
    expect(S().deletePaymentMethod('Deel')).toBe(false)
    expect(S().paymentMethods.find((m) => m.id === 'Deel')).toBe(before)
  })
  it('delete answered with I spent it: the account then goes (closed, since it has history) and holds nothing set aside', () => {
    expect(answerSetAsideMoney('Deel', { kind: 'spent' }, heldIn('Deel'))).toBe(0)
    expect(S().deletePaymentMethod('Deel')).toBe(true)
    expect(S().paymentMethods.find((m) => m.id === 'Deel')?.closedAt).toBeTruthy()
    expect(heldIn('Deel')).toBe(0)
  })
})

describe('N3: Undo after a shortfall label', () => {
  it.todo('T26 applied; CIB −80,000 Dec 3; I spent it on MS 12,900 → short 28,100 stays open, month-end Undo disabled (P6)')
})

describe('N4: two pockets, partial move', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      paymentMethods: [pm('X', { openingBalance: 10000 }), pm('NBE', { openingBalance: 5000 })],
      expenses: [expense('drop', 8000, 'X', '2025-12-01')],
      incomeEvents: [], debts: [], debtPayments: [], savingsTransactions: [], goals: [],
      savingsAccounts: [part('A', 4000, { heldInPaymentMethodId: 'X', createdAt: '2025-11-02' }), part('B', 4000, { heldInPaymentMethodId: 'X', createdAt: '2025-11-03' })],
    })
  })
  it('B moves whole to NBE, A cannot fit, 2,000 stays short in the same episode; then I spent it 2,000 from A', () => {
    expect(shortOf(ledger(), 'X')).toBe(6000)
    const key = shortfallEpisodes(ledger())[0].key
    expect(planMove(ledger(), [], 'X', 'NBE', 6000).steps.map((s) => s.partId)).toEqual(['B'])
    expect(answerSetAsideMoney('X', { kind: 'move', toId: 'NBE' }, shortIn('X'))).toBe(2000)
    expect(part$('B')).toBeUndefined()
    expect(bal('NBE')).toEqual({ balance: 5000, held: 4000, free: 1000 })
    expect(shortfallEpisodes(ledger()).map((e) => [e.key, e.short])).toEqual([[key, 2000]])
    expect(answerSetAsideMoney('X', { kind: 'spent' }, shortIn('X'))).toBe(0)
    expect(part$('A')?.currentBalance).toBe(2000)
    expect(bal('X')).toEqual({ balance: 2000, held: 2000, free: 0 })
    expect(shortfallEpisodes(ledger())).toEqual([])
  })
  it('covered, then short again: a new episode with a new key', () => {
    const first = shortfallEpisodes(ledger())[0].key
    answerSetAsideMoney('X', { kind: 'spent' }, shortIn('X'))
    expect(shortfallEpisodes(ledger())).toEqual([])
    vi.setSystemTime(new Date(2025, 11, 5, 12))
    useFinanceStore.setState((s) => ({ expenses: [...s.expenses, expense('drop2', 500, 'X', '2025-12-04')] }))
    const again = shortfallEpisodes(ledger())
    expect(again).toHaveLength(1)
    expect(again[0].key).not.toBe(first)
    expect(again[0].short).toBe(500)
  })
})

describe('episode key across a pocket move', () => {
  it('two drops, then a whole pocket moves out: the episode keeps its first drop', () => {
    useFinanceStore.setState({
      paymentMethods: [pm('X', { openingBalance: 10000 }), pm('NBE', { openingBalance: 5000 })],
      expenses: [expense('d1', 2000, 'X', '2025-11-28'), expense('d2', 4000, 'X', '2025-12-01')],
      incomeEvents: [], debts: [], debtPayments: [], savingsTransactions: [], goals: [],
      savingsAccounts: [part('A', 5000, { heldInPaymentMethodId: 'X', createdAt: '2025-11-02' }), part('B', 4000, { heldInPaymentMethodId: 'X', createdAt: '2025-11-03' })],
    })
    const key = shortfallEpisodes(ledger())[0].key
    expect(key).toBe(`shortfall:X:${new Date('2025-11-28T12:00:00').getTime()}`)
    expect(answerSetAsideMoney('X', { kind: 'move', toId: 'NBE' }, shortIn('X'))).toBe(1000)
    expect(part$('B')).toBeUndefined()
    expect(shortfallEpisodes(ledger()).map((e) => [e.key, e.short])).toEqual([[key, 1000]])
  })
})

describe('a legacy part in another currency than its account', () => {
  it('heldIn, I spent it and It is in another account count it in the account currency', () => {
    useFinanceStore.setState({
      paymentMethods: [pm('X', { openingBalance: 10000 }), pm('NBE', { openingBalance: 20000 })],
      expenses: [expense('d', 10000, 'X', '2025-12-01')],
      incomeEvents: [], debts: [], debtPayments: [], savingsTransactions: [], goals: [],
      savingsAccounts: [part('usd', 100, { currency: 'USD', heldInPaymentMethodId: 'X', isMonthlySavings: true })],
    })
    expect(heldIn('X')).toBe(5000)
    expect(shortIn('X')).toBe(5000)
    expect(planSpent(ledger(), [], 'X', 2500)).toEqual([{ partId: 'usd', amount: 50, amountInAccount: 2500 }])
    expect(planMove(ledger(), [], 'X', 'NBE', 2500).steps).toEqual([{ partId: 'usd', amount: 50, amountInAccount: 2500, amountInB: 2500 }])
  })
})

describe('other removal paths respect the guard', () => {
  it('a provisional account holding set-aside money is never merged; voice delete is refused with an error', () => {
    const prov = pm('prov', { provisional: true })
    const ledgerish = { expenses: [], incomeEvents: [], savingsAccounts: [part('p', 10, { heldInPaymentMethodId: 'prov' })] }
    expect(planMerge([prov, pm('mine')], ledgerish, 'prov', 'mine')).toBeNull()
    expect(planMerge([prov, pm('mine')], { ...ledgerish, savingsAccounts: [] }, 'prov', 'mine')).not.toBeNull()
    const ctx = buildAIActionHandlerContext(S())
    expect(validateActionItem(ctx, 'delete_payment_method', { name: 'Deel' })).toContain('set aside')
    expect(() => executeActionItem(ctx, 'delete_payment_method', { name: 'Deel' })).toThrow(/set aside/)
    expect(S().paymentMethods.find((m) => m.id === 'Deel')?.closedAt).toBeUndefined()
  })
})

describe('no change when nothing is short', () => {
  it('fixture F: no episode, every part covered whole, and an account with nothing set aside closes and deletes as before', () => {
    expect(shortfallEpisodes(ledger())).toEqual([])
    const cov = coveredParts(ledger(), S().goals)
    for (const p of S().savingsAccounts) expect(cov.get(p.id)).toBe(p.currentBalance)
    expect(bal('CIB')).toEqual({ balance: 100000, held: 28000, free: 66000 })
    expect(closeAccount('NBE')).toBe(true)
    const removal = removePaymentMethod(S(), 'Cash', 'close')
    expect(removal).toBeNull()
    useFinanceStore.setState((s) => ({ paymentMethods: [...s.paymentMethods, pm('fresh', { openingAt: undefined })] }))
    expect(S().deletePaymentMethod('fresh')).toBe(true)
    expect(S().paymentMethods.some((m) => m.id === 'fresh')).toBe(false)
  })
})
