import { beforeEach, describe, expect, it } from 'vitest'
import type { AccountAdjustment, Debt, Expense, Goal, IncomeEvent, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { anchorGaps, balancesOverTime, computeBalances, type LedgerInput } from '../balance'
import { accountsBasisFor } from '../netWorthBasis'
import { addAlreadySaved, ensureGoalPart, updateBalance } from '../actions'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { partId } from '@/lib/savings/partId'
import { cashSavingsDepositsInBaseForMonth, netSavingsLedgerInBaseForMonth, totalDebtRemainingDetail } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'

/**
 * LOGIC_SPEC §6, P2 rows (T4, T5, T6, T21, T22, T48, N7) on fixture F (dates in 2025, as in ledgerCorrectnessP1).
 * Wedding's 10 g of 21k is stored as 8.75 g at the 24k price until P5. Since P3 the card holds back what it owes; this
 * seed has no TV plan debt, so the whole 16,000 is held back from CIB (free 56,000; the spec's F, with the plan, has 66,000).
 */
const RATES = { USD_EGP: 50, EGP_USD: 0.02 }
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
const adj = (id: string, accountId: string, occurredAt: string, over: Partial<AccountAdjustment>): AccountAdjustment =>
  ({ id, paymentMethodId: accountId, delta: 0, reason: 'manual_update', occurredAt, createdAt: occurredAt, updatedAt: occurredAt, ...over })
const CARD_DEBT = { id: 'cardDebt', name: 'card', person: '', startingBalance: 0, currency: 'EGP', isGold: false, direction: 'i_owe', status: 'active', debtType: 'credit_card', linkedPaymentMethodId: 'card', createdAt: '2025-11-01' } as unknown as Debt

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
    debts: [CARD_DEBT],
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
const bal = (id: string) => computeBalances(ledger()).get(id)!
const netWorth = (rates: Record<string, number> = S().exchangeRates) => {
  const s = S()
  const basis = accountsBasisFor(ledger(rates), 'EGP')
  const debtRemaining = totalDebtRemainingDetail(s.debts, [], 'EGP', rates, GOLD, true, s.expenses).total
  return computeNetWorth({
    ...basis, savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: s.debts,
    settings: { baseCurrency: 'EGP', secondaryCurrency: null, showSecondaryCurrency: false } as never,
    exchangeRates: rates, goldPricePerGram: GOLD, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining,
  }).netWorth
}
const gold = { pricePerGram: GOLD, available: true }

beforeEach(() => seedF())

describe('T4: labels never move balances', () => {
  it('release Travel 2,000; spent MS 3,000; set_aside Travel 1,000', () => {
    const dec = { date: '2025-12-03', occurredAt: '2025-12-03T10:00:00.000Z' }
    const steps: Array<[() => boolean, number]> = [
      [() => S().releasePart('travel', 2000, dec), 26000],
      [() => S().markSpent('ms', 3000, dec), 23000],
      [() => S().setAsideInPart('travel', 1000, dec), 24000],
    ]
    expect(bal('CIB')).toMatchObject({ balance: 100000, held: 28000, cardHold: 16000, free: 56000 })
    for (const [write, held] of steps) {
      expect(write()).toBe(true)
      expect(bal('CIB')).toMatchObject({ balance: 100000, held, free: 100000 - held - 16000 })
      expect(netWorth()).toBe(171000)
    }
    const labels = S().savingsTransactions
    expect(labels.map((t) => [t.source, t.isCashFlow, t.paymentMethodId, t.transferGroupId, t.id === t.idempotencyKey])).toEqual([
      ['release', false, undefined, undefined, true], ['spent', false, undefined, undefined, true], ['set_aside', false, undefined, undefined, true],
    ])
    // savedNet(Dec) = +1,000 set aside − 3,000 spent; the release is not counted.
    expect(netSavingsLedgerInBaseForMonth(labels, '2025-12', 1, 'EGP', RATES, gold)).toBe(-2000)
    expect(cashSavingsDepositsInBaseForMonth(labels, '2025-12', 1, 'EGP', RATES, gold)).toBe(1000)
  })
  it('a retried write with the same key is one row', () => {
    expect(S().releasePart('travel', 500, { key: 'k1' })).toBe(true)
    expect(S().releasePart('travel', 500, { key: 'k1' })).toBe(true)
    expect(S().savingsTransactions).toHaveLength(1)
    expect(S().savingsAccounts.find((p) => p.id === 'travel')!.currentBalance).toBe(4500)
  })
  it('refuses a release over the balance, a set-aside over free, and both on an outside part', () => {
    expect(S().releasePart('travel', 6000)).toBe(false)
    expect(S().setAsideInPart('travel', 72001)).toBe(false)
    expect(S().releasePart('wedding', 1)).toBe(false)
    expect(S().setAsideInPart('wedding', 1)).toBe(false)
    expect(S().savingsTransactions).toHaveLength(0)
  })
  it('depositToSavings into a held part is a set_aside label; "back to income" kept in the account is a release', () => {
    expect(S().depositToSavings('travel', 1000, 'EGP')).toBe(true)
    expect(S().withdrawFromSavings('travel', 400, 'EGP', undefined, 'income', { toAccountId: null })).toBe(true)
    expect(S().savingsTransactions.map((t) => t.source)).toEqual(['set_aside', 'release'])
    expect(S().incomeEvents).toHaveLength(2) // no income event from the release
    expect(bal('CIB')).toMatchObject({ balance: 100000, held: 28600 })
  })
  it('Monthly savings cannot be deleted; deleting a pocket releases it (held 23,000, NW same)', async () => {
    const { canDeletePocket } = await import('@/lib/savings/canDeletePocket')
    expect(canDeletePocket(S(), 'ms')).toEqual({ ok: false, reason: 'system' })
    S().deleteSavingsAccount('travel')
    expect(bal('CIB')).toMatchObject({ balance: 100000, held: 23000, free: 61000 })
    expect(netWorth()).toBe(171000)
  })
  it('moving a goal part to another account labels both sides; the new part has the deterministic id', () => {
    expect(S().movePart('carCIB', 'NBE', 5000)).toBe(false) // NBE has 0 free
    useFinanceStore.setState((s) => ({ paymentMethods: s.paymentMethods.map((m) => (m.id === 'NBE' ? { ...m, openingBalance: 8000 } : m)) }))
    expect(S().movePart('carCIB', 'NBE', 5000)).toBe(true)
    const q = partId({ goalId: 'car' }, 'NBE')
    const [out, into] = S().savingsTransactions
    expect([out.source, into.source, into.accountId, out.pairId === into.pairId]).toEqual(['move_out', 'move_in', q, true])
    expect(bal('CIB')).toMatchObject({ balance: 100000, held: 23000 })
    expect(bal('NBE')).toMatchObject({ balance: 8000, held: 5000 })
    expect(S().goals.find((g) => g.id === 'car')!.linkedSavingsAccountIds).toContain(q)
  })
})

describe('move follow-ups', () => {
  it('a pocket moves whole: every goal listing it lists the new row instead', () => {
    useFinanceStore.setState((s) => ({
      paymentMethods: s.paymentMethods.map((m) => (m.id === 'NBE' ? { ...m, openingBalance: 8000 } : m)),
      goals: s.goals.map((g) => (g.id === 'car' ? { ...g, linkedSavingsAccountIds: [...g.linkedSavingsAccountIds, 'travel'] } : g)),
    }))
    expect(S().movePart('travel', 'NBE')).toBe(true)
    const moved = S().savingsAccounts.find((p) => p.heldInPaymentMethodId === 'NBE')!
    expect(S().savingsAccounts.some((p) => p.id === 'travel')).toBe(false)
    expect(S().goals.find((g) => g.id === 'car')!.linkedSavingsAccountIds).toEqual(['carCIB', 'carDeel', moved.id])
    expect(bal('NBE')).toMatchObject({ balance: 8000, held: 5000 })
  })
  it('deleting one half of a move removes both halves', () => {
    useFinanceStore.setState((s) => ({ paymentMethods: s.paymentMethods.map((m) => (m.id === 'NBE' ? { ...m, openingBalance: 8000 } : m)) }))
    expect(S().movePart('carCIB', 'NBE', 5000)).toBe(true)
    const [out] = S().savingsTransactions
    expect(S().deleteSavingsTransaction(out.id)).toEqual({ ok: true })
    expect(S().savingsTransactions).toHaveLength(0)
    expect(S().savingsAccounts.find((p) => p.id === 'carCIB')!.currentBalance).toBe(20000)
    expect(S().savingsAccounts.find((p) => p.id === partId({ goalId: 'car' }, 'NBE'))!.currentBalance).toBe(0)
  })
})

describe('T5: anchor and a late SMS', () => {
  it('Dec 2 anchor 97,000 (ledger 100,000); a −500 debit dated Dec 1 arrives after', () => {
    useFinanceStore.setState({ accountAdjustments: [adj('a1', 'CIB', '2025-12-02T10:00:00.000Z', { anchorBalance: 97000, delta: -3000 })] })
    expect(bal('CIB').balance).toBe(97000)
    useFinanceStore.setState((s) => ({ expenses: [...s.expenses, expense('late', 500, 'CIB', '2025-12-01', { occurredAt: '2025-12-01T12:00:00.000Z' })] }))
    expect(bal('CIB').balance).toBe(97000)
    const gaps = anchorGaps(ledger()).map((g) => g.gap)
    expect(gaps).toEqual([-2500])
    expect(Math.max(0, -gaps.reduce((a, b) => a + b, 0))).toBe(2500) // unexplainedOut(Dec)
    expect(S().expenses.filter((e) => e.date.startsWith('2025-12')).reduce((n, e) => n + e.amount, 0)).toBe(500) // spending(Dec) +500
  })
  it('updateBalance writes an anchor (delta kept for display); a row dated before it is inside it', () => {
    updateBalance('CIB', 100000, 97000)
    expect(S().accountAdjustments.at(-1)).toMatchObject({ anchorBalance: 97000, delta: -3000 })
    useFinanceStore.setState((s) => ({ expenses: [...s.expenses, expense('older', 500, 'CIB', '2025-12-01', { occurredAt: '2025-12-01T12:00:00.000Z' })] }))
    expect(bal('CIB').balance).toBe(97000)
  })
  it('balancesOverTime agrees with computeBalances around anchors', () => {
    useFinanceStore.setState((s) => ({
      accountAdjustments: [adj('a1', 'CIB', '2025-12-02T10:00:00.000Z', { anchorBalance: 97000 }), adj('a0', 'CIB', '2025-11-20T10:00:00.000Z', { anchorBalance: 40000 })],
      expenses: [...s.expenses, expense('late', 500, 'CIB', '2025-12-01', { occurredAt: '2025-12-01T12:00:00.000Z' }), expense('after', 700, 'CIB', '2025-12-05')],
    }))
    const at = balancesOverTime(ledger())
    for (const iso of ['2025-11-15', '2025-11-20T10:00:00Z', '2025-11-26', '2025-12-02T09:59:00Z', '2025-12-02T10:00:00Z', '2025-12-04', '2025-12-06']) {
      const t = new Date(iso).getTime()
      expect(at(t).get('CIB')?.balance).toBe(computeBalances(ledger(), t).get('CIB')?.balance)
    }
    expect(at(new Date('2025-12-06').getTime()).get('CIB')?.balance).toBe(96300)
  })
})

describe('T6: booked rate', () => {
  it('Deel→CIB $1,000 booked at 50,000: CIB 150,000 at 50 and at 45', () => {
    useFinanceStore.setState((s) => ({
      expenses: [...s.expenses, expense('xfer', 1000, 'Deel', '2025-12-01', { currency: 'USD', category: 'Transfer', toPaymentMethodId: 'CIB', toAccountAmount: 50000 })],
    }))
    for (const rates of [RATES, { USD_EGP: 45, EGP_USD: 1 / 45 }]) {
      const b = computeBalances(ledger(rates))
      expect(b.get('CIB')?.balance).toBe(150000)
      expect(b.get('Deel')?.balance).toBe(0)
      expect(netWorth(rates)).toBe(171000)
    }
  })
  it('a source-side booked amount scales with a partial refund', () => {
    useFinanceStore.setState((s) => ({
      expenses: [...s.expenses, expense('usdBuy', 100, 'CIB', '2025-12-01', { currency: 'USD', accountAmount: 4800, refundedAmount: 25 })],
    }))
    expect(computeBalances(ledger({ USD_EGP: 60, EGP_USD: 1 / 60 })).get('CIB')?.balance).toBe(100000 - 3600)
  })
})

describe('T21: cash at home', () => {
  it('5,000 into new pocket Home: Cash anchor 7,000, Home 5,000 (opening), NW 176,000, not this month\'s saving', () => {
    const home = S().addSavingsAccount({ name: 'Home', category: 'savings', type: 'vault', currency: 'EGP', heldInPaymentMethodId: 'Cash' })
    expect(addAlreadySaved(home, 5000, new Date('2025-11-29T10:00:00Z'))).toBe(true)
    expect(S().accountAdjustments.at(-1)).toMatchObject({ paymentMethodId: 'Cash', anchorBalance: 7000, reason: 'opening_correction' })
    expect(bal('Cash')).toMatchObject({ balance: 7000, held: 5000 })
    expect(S().savingsTransactions.at(-1)).toMatchObject({ source: 'opening', isCashFlow: false })
    expect(netWorth()).toBe(176000)
    expect(cashSavingsDepositsInBaseForMonth(S().savingsTransactions, '2025-11', 1, 'EGP', RATES, gold)).toBe(0)
  })
})

describe('T22: gold outside', () => {
  it('+2 g of 21k (1.75 g at 24k) to Wedding: Wedding 42,000, NW 178,000, not income', () => {
    expect(S().setAsideInPart('wedding', 1.75, { source: 'opening', date: '2025-11-29' })).toBe(true)
    expect(S().savingsAccounts.find((p) => p.id === 'wedding')!.currentBalance * GOLD).toBe(42000)
    expect(netWorth()).toBe(178000)
    expect(S().incomeEvents).toHaveLength(2)
    expect(cashSavingsDepositsInBaseForMonth(S().savingsTransactions, '2025-11', 1, 'EGP', RATES, gold)).toBe(0)
  })
})

describe('T48: account not added yet', () => {
  it('QNB EGP 12,000 and an opening 12,000 into Wedding: Wedding 47,000, NW 183,000', () => {
    useFinanceStore.setState((s) => ({ paymentMethods: [...s.paymentMethods, pm('QNB', { openingBalance: 12000, openingAt: '2025-11-29T09:00:00.000Z' })] }))
    const id = ensureGoalPart('wedding', 'QNB')!
    expect(id).toBe(partId({ goalId: 'wedding' }, 'QNB'))
    expect(ensureGoalPart('wedding', 'QNB')).toBe(id)
    expect(addAlreadySaved(id, 12000, new Date('2025-11-29T10:00:00Z'))).toBe(true)
    const parts = S().savingsAccounts.filter((p) => p.goalId === 'wedding')
    expect(parts.reduce((n, p) => n + (p.currency === 'XAU' ? p.currentBalance * GOLD : p.currentBalance), 0)).toBe(47000)
    expect(bal('QNB')).toMatchObject({ balance: 12000, held: 12000 })
    expect(netWorth()).toBe(183000)
    expect(cashSavingsDepositsInBaseForMonth(S().savingsTransactions, '2025-11', 1, 'EGP', RATES, gold)).toBe(0) // leftover(Nov) unchanged
  })
})

describe('N7: an earlier-dated anchor', () => {
  it('Dec 2 anchor 100,000 (= ledger), then a late report dated Dec 1 09:00 = 99,000: gaps −1,500 and +1,500, unexplainedOut 0', () => {
    useFinanceStore.setState((s) => ({
      incomeEvents: [...s.incomeEvents, income('bonus', 500, 'EGP', 'CIB', '2025-11-30')],
      expenses: [...s.expenses, expense('d1', 500, 'CIB', '2025-12-01', { occurredAt: '2025-12-01T12:00:00.000Z' })],
      accountAdjustments: [adj('dec2', 'CIB', '2025-12-02T10:00:00.000Z', { anchorBalance: 100000 })],
    }))
    expect(computeBalances(ledger(), new Date('2025-12-01T09:00:00Z').getTime()).get('CIB')?.balance).toBe(100500)
    expect(bal('CIB').balance).toBe(100000)
    useFinanceStore.setState((s) => ({ accountAdjustments: [...s.accountAdjustments, adj('dec1', 'CIB', '2025-12-01T09:00:00.000Z', { anchorBalance: 99000 })] }))
    expect(bal('CIB').balance).toBe(100000)
    const gaps = anchorGaps(ledger())
    expect(gaps.map((g) => [g.adjustmentId, g.gap])).toEqual([['dec1', -1500], ['dec2', 1500]])
    expect(Math.max(0, -gaps.reduce((a, g) => a + g.gap, 0))).toBe(0)
  })
})

describe('regression: no labels, anchors or booked amounts = today\'s numbers', () => {
  it('fixture F with a legacy delta adjustment and an unbooked cross-currency income', () => {
    useFinanceStore.setState((s) => ({
      incomeEvents: [...s.incomeEvents, income('usd', 100, 'USD', 'CIB', '2025-11-27')],
      accountAdjustments: [adj('legacy', 'CIB', '2025-11-28T10:00:00.000Z', { delta: -250, reason: 'gap' })],
    }))
    const b = computeBalances(ledger())
    expect(Object.fromEntries([...b].map(([id, a]) => [id, [a.balance, a.held, a.free]]))).toEqual({
      CIB: [104750, 28000, 60750], Deel: [1000, 200, 800], Cash: [2000, 0, 2000], NBE: [0, 0, 0],
    })
    expect(netWorth()).toBe(175750)
    expect(anchorGaps(ledger())).toEqual([])
    const flows = computeBalances({ ...ledger(), flowsFrom: new Date('2025-11-01T00:00:01Z').getTime() }).get('CIB')!
    expect([flows.flowsIn, flows.flowsOut]).toEqual([65000, 20000])
    const at = balancesOverTime(ledger())
    expect(at(Date.now()).get('CIB')?.balance).toBe(104750)
  })
  it('flows still count legs behind an anchor', () => {
    useFinanceStore.setState({ accountAdjustments: [adj('a', 'CIB', '2025-11-28T10:00:00.000Z', { anchorBalance: 99000 })] })
    const flows = computeBalances({ ...ledger(), flowsFrom: new Date('2025-11-01T00:00:01Z').getTime() }).get('CIB')!
    expect([flows.balance, flows.flowsIn, flows.flowsOut]).toEqual([99000, 60000, 20000])
  })
})
