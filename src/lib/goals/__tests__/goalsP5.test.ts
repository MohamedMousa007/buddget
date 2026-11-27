import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Debt, Expense, Goal, IncomeEvent, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeBalances, type LedgerInput } from '@/lib/accounts/balance'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { canDeletePocket } from '@/lib/savings/canDeletePocket'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { buildGoalProgressContext, computeGoalProgress, computeGoalProgressDetail } from '@/lib/goals/computeGoalProgress'
import { keepAchieved, reconcileAchievedGoals, revertAchievedForMonthEndUndo } from '@/lib/goals/reconcileAchievedGoals'
import { savingsAccountFromRow, savingsAccountToRow } from '@/lib/supabase/remote/mappers/savingsAccountMapper'
import { mergeSnapshots } from '@/lib/supabase/remote/merge'
import { deleteGoalWithUndo } from '@/lib/goals/goalDeleteUndo'
import { totalDebtRemainingDetail } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'

/**
 * LOGIC_SPEC §6, P5 rows (T17, T18, T24, T41–T45) on fixture F, read on Dec 3 2025 (local). Wedding is 10 g of 21k
 * (3,500 a gram at 4,000 for 24k), the karat kept on the part.
 */
const RATES = { USD_EGP: 50, EGP_USD: 0.02 }
const GOLD = 4000
const OPEN = '2025-11-01T00:00:00.000Z'
const USER = '11111111-2222-4333-8444-555555555555'

const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2025-11-01', openingAt: OPEN, ...over }) as PaymentMethod
const part = (id: string, currentBalance: number, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'vault', currency: 'EGP', currentBalance, createdAt: '2025-11-01', ...over }) as SavingsAccount
const expense = (id: string, amount: number, paymentMethodId: string, date: string): Expense =>
  ({ id, amount, currency: 'EGP', category: 'Food', description: id, date, paymentMethodId, isRecurring: false, createdAt: date }) as Expense
const income = (id: string, amount: number, currency: string, paymentMethodId: string, receivedDate: string): IncomeEvent =>
  ({ id, amount, currency, paymentMethodId, receivedDate, status: 'confirmed', createdAt: receivedDate }) as unknown as IncomeEvent
const goal = (id: string, target: number, priority: number, linked: string[], over: Partial<Goal> = {}): Goal =>
  ({ id, name: id, category: 'quality_of_life', currency: 'EGP', targetAmount: target, priority, status: 'active', linkedSavingsAccountIds: linked, linkedDebtIds: [], manualCurrentAmount: 0, fundingMode: 'share', createdAt: '2025-11-01', achievedAt: null, ...over }) as unknown as Goal
const debt = (id: string, over: Partial<Debt>): Debt =>
  ({ id, name: id, person: '', startingBalance: 0, currency: 'EGP', isGold: false, direction: 'i_owe', status: 'active', createdAt: '2025-11-01', ...over }) as Debt

const CARD = debt('cardDebt', { debtType: 'credit_card', linkedPaymentMethodId: 'card', paymentDueDay: 10 })
const TV = debt('tv', {
  name: 'TV', person: 'Installment', debtType: 'installment', startingBalance: 12000, installmentCount: 6, installmentAmount: 2000,
  installmentFrequency: 'monthly', startDate: '2025-12-10', installmentProvider: 'credit_card', linkedCreditCardDebtId: 'cardDebt', createdAt: '2025-11-12',
})

function seedF() {
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
      part('wedding', 10, { currency: 'XAU', type: 'gold', goalId: 'wedding', karat: 21 }),
    ],
    savingsTransactions: [],
    accountAdjustments: [],
    goals: [goal('car', 150000, 1, ['carCIB', 'carDeel']), goal('wedding', 50000, 3, ['wedding'])],
    recurringSavingsDeposits: [],
    recurringDebtPayments: [],
    subscriptions: [],
    incomeSources: [],
    exchangeRates: RATES,
    goldPricePerGram: GOLD,
    goldPriceAvailable: true,
    goldPriceStale: false,
    lastGoldFetch: '2025-12-03T09:00:00.000Z',
    profile: { ...useFinanceStore.getState().profile, id: USER, defaultCarryPocketId: null },
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP', monthStartDay: 1 },
  })
}

const S = () => useFinanceStore.getState()
const ledger = (): LedgerInput => {
  const s = S()
  return {
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debts: s.debts, debtPayments: s.debtPayments,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments,
    convert: (a, from, to) => tryConvertCurrency(a, from, to, s.exchangeRates),
  }
}
const bal = (id: string) => {
  const b = computeBalances(ledger()).get(id)!
  return { balance: b.balance, held: b.held, free: b.free }
}
const nw = (available = true) => {
  const s = S()
  const basis = accountsBasisFor(ledger(), 'EGP')
  const debtRemaining = totalDebtRemainingDetail(s.debts, s.debtPayments, 'EGP', s.exchangeRates, GOLD, true, s.expenses).total
  return computeNetWorth({
    ...basis, savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: s.debts,
    settings: { baseCurrency: 'EGP', secondaryCurrency: null, showSecondaryCurrency: false } as never,
    exchangeRates: s.exchangeRates, goldPricePerGram: GOLD, goldPriceAvailable: available, lookup: (() => null) as never, debtRemaining,
  })
}
const ctx = () => buildGoalProgressContext(S(), '2025-12')
const progress = (id: string) => computeGoalProgress(S().goals.find((g) => g.id === id)!, ctx())
const goal$ = (id: string) => S().goals.find((g) => g.id === id)!
const debitCIB = (amount: number) => useFinanceStore.setState((s) => ({ expenses: [...s.expenses, expense('dec1', amount, 'CIB', '2025-12-01')] }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2025, 11, 3, 12))
  seedF()
})
afterEach(() => vi.useRealTimers())

describe('fixture F progress (§4.5)', () => {
  it('Car 30,000 from its two parts; Wedding 35,000 at the 21k price; NW 171,000', () => {
    expect(progress('car')).toBe(30000)
    expect(progress('wedding')).toBe(35000)
    expect(nw().netWorth).toBe(171000)
  })
  it('a part found by goalId counts even when the goal does not list it (cached rows after P2)', () => {
    useFinanceStore.setState((s) => ({ goals: s.goals.map((g) => (g.id === 'car' ? { ...g, linkedSavingsAccountIds: [] } : g)) }))
    expect(progress('car')).toBe(30000)
  })
  it('a listed part that belongs to another goal is never counted', () => {
    useFinanceStore.setState((s) => ({ goals: s.goals.map((g) => (g.id === 'wedding' ? { ...g, linkedSavingsAccountIds: ['wedding', 'carCIB'] } : g)) }))
    expect(progress('wedding')).toBe(35000)
  })
})

describe('karat per part (savingsConversions)', () => {
  it('values a part at its own karat; no karat stays 24k', () => {
    const p21 = part('g21', 10, { currency: 'XAU', karat: 21 })
    const p24 = part('g24', 10, { currency: 'XAU' })
    expect(savingsAccountBalanceInBase(p21, 'EGP', RATES, GOLD, true)).toBe(35000)
    expect(savingsAccountBalanceInBase(p24, 'EGP', RATES, GOLD, true)).toBe(40000)
  })
  it('the karat syncs in metadata and comes back; none stays absent', () => {
    const row = savingsAccountToRow(part('g21', 10, { currency: 'XAU', karat: 21 }), USER)
    expect(row.metadata).toEqual({ karat: 21 })
    expect(savingsAccountFromRow({ ...row, edited_at: 'x', updated_at: 'x', deleted_at: null } as never).karat).toBe(21)
    expect(savingsAccountFromRow({ ...savingsAccountToRow(part('e', 1), USER), edited_at: 'x' } as never)).not.toHaveProperty('karat')
  })
})

describe('T17: achieved is permanent', () => {
  beforeEach(() => {
    useFinanceStore.setState((s) => ({
      savingsAccounts: [...s.savingsAccounts, part('phoneCIB', 10000, { heldInPaymentMethodId: 'CIB', goalId: 'phone' })],
      goals: [...s.goals, goal('phone', 10000, 2, ['phoneCIB'])],
    }))
  })
  it('achieves at target, then stays achieved after a release to 0; progress 0', () => {
    useFinanceStore.setState((s) => ({ goals: reconcileAchievedGoals(s.goals, ctx()).goals }))
    expect(goal$('phone').status).toBe('achieved')
    expect(S().releasePart('phoneCIB', 10000)).toBe(true)
    expect(goal$('phone').status).toBe('achieved')
    expect(progress('phone')).toBe(0)
  })
  it('a write of active (an old build, a resume) never un-achieves; the rest of the write lands', () => {
    S().achieveGoal('phone')
    const at = goal$('phone').achievedAt
    S().updateGoal('phone', { status: 'active', achievedAt: null, name: 'Phone 16' })
    expect(goal$('phone')).toMatchObject({ status: 'achieved', achievedAt: at, name: 'Phone 16' })
    S().updateGoal('phone', { status: 'paused' })
    expect(goal$('phone').status).toBe('achieved')
  })
  it('keepAchieved strips only the status fields', () => {
    expect(keepAchieved({ status: 'achieved' }, { status: 'active', achievedAt: null, notes: 'x' })).toEqual({ notes: 'x' })
    expect(keepAchieved({ status: 'paused' }, { status: 'active' })).toEqual({ status: 'active' })
  })
  it('the month-end Undo seam is the one path back to active (P6 wires it)', () => {
    S().achieveGoal('phone')
    const next = revertAchievedForMonthEndUndo(S().goals, ['phone'])
    expect(next.find((g) => g.id === 'phone')).toMatchObject({ status: 'active', achievedAt: null })
    expect(next.find((g) => g.id === 'car')).toBe(goal$('car'))
  })
})

describe('T18: achieved under FX', () => {
  it('Laptop $200 on Deel $200 achieves, and stays achieved when the rate drops', () => {
    useFinanceStore.setState((s) => ({
      savingsAccounts: [...s.savingsAccounts, part('lapDeel', 200, { currency: 'USD', heldInPaymentMethodId: 'Deel', goalId: 'laptop' })],
      goals: [...s.goals, goal('laptop', 200, 4, ['lapDeel'], { currency: 'USD' })],
    }))
    useFinanceStore.setState((s) => ({ goals: reconcileAchievedGoals(s.goals, ctx()).goals }))
    expect(goal$('laptop').status).toBe('achieved')
    useFinanceStore.setState({ exchangeRates: { USD_EGP: 45, EGP_USD: 1 / 45 } })
    S().updateGoal('laptop', { status: 'active' })
    useFinanceStore.setState((s) => ({ goals: reconcileAchievedGoals(s.goals, ctx()).goals }))
    expect(goal$('laptop').status).toBe('achieved')
  })
})

describe('T24: an outside part is unaffected by a short account', () => {
  it('T11 state: Wedding 35,000; Car 28,000 (only what CIB still covers)', () => {
    debitCIB(82000)
    expect(progress('wedding')).toBe(35000)
    expect(progress('car')).toBe(28000)
  })
})

describe('T41: delete a goal with held parts', () => {
  it('releases CIB 20,000 and Deel $200; held(CIB) 8,000; free(CIB) 86,000; free(Deel) $1,000; NW 171,000', () => {
    S().deleteGoal('car')
    expect(S().savingsAccounts.some((p) => p.id === 'carCIB' || p.id === 'carDeel')).toBe(false)
    expect(bal('CIB')).toMatchObject({ balance: 100000, held: 8000, free: 86000 })
    expect(bal('Deel')).toMatchObject({ balance: 1000, held: 0, free: 1000 })
    expect(nw().netWorth).toBe(171000)
  })
  it('Undo puts the goal and its parts back; held(CIB) 28,000 again', () => {
    const undo = deleteGoalWithUndo('car')
    expect(bal('CIB').held).toBe(8000)
    undo()
    expect(goal$('car')).toBeTruthy()
    expect(S().savingsAccounts.filter((p) => p.goalId === 'car').map((p) => p.id).sort()).toEqual(['carCIB', 'carDeel'])
    expect(bal('CIB')).toMatchObject({ balance: 100000, held: 28000, free: 66000 })
    expect(progress('car')).toBe(30000)
  })
})

describe('T41 guard: rows a goal only lists', () => {
  it('Monthly savings and a pocket the goal lists survive its delete (T45)', () => {
    useFinanceStore.setState((s) => ({ goals: s.goals.map((g) => (g.id === 'car' ? { ...g, linkedSavingsAccountIds: [...g.linkedSavingsAccountIds, 'ms', 'travel'] } : g)) }))
    S().deleteGoal('car')
    expect(S().savingsAccounts.map((p) => p.id).sort()).toEqual(['ms', 'travel', 'wedding'])
    expect(bal('CIB').held).toBe(8000)
  })
})

describe('T42: delete a goal with an outside part', () => {
  it('Keep: the part stays as a pocket (goal_id NULL); NW 171,000', () => {
    S().deleteGoal('wedding')
    expect(S().savingsAccounts.find((p) => p.id === 'wedding')).toMatchObject({ goalId: null, currentBalance: 10 })
    expect(nw().netWorth).toBe(171000)
  })
})

describe('T43: delete a pocket', () => {
  it('releases Travel 5,000; held(CIB) 23,000; free(CIB) 71,000; NW 171,000', () => {
    S().deleteSavingsAccount('travel')
    expect(bal('CIB')).toMatchObject({ balance: 100000, held: 23000, free: 71000 })
    expect(nw().netWorth).toBe(171000)
  })
})

describe('T44: missing gold price', () => {
  it('stale price: Wedding counted at the last price, with its date (never dropped)', () => {
    useFinanceStore.setState({ goldPriceStale: true, lastGoldFetch: '2025-11-29T10:00:00.000Z' })
    const d = computeGoalProgressDetail(goal$('wedding'), ctx())
    expect(d.amount).toBe(35000)
    expect(d.stalePrice).toEqual({ perGram: 3500, at: '2025-11-29T10:00:00.000Z' })
    expect(d.priceMissing).toBeNull()
  })
  it('a stale price never auto-achieves (achieved is final)', () => {
    useFinanceStore.setState((s) => ({ goldPriceStale: true, goals: s.goals.map((g) => (g.id === 'wedding' ? { ...g, targetAmount: 30000 } : g)) }))
    expect(reconcileAchievedGoals(S().goals, ctx()).newlyAchievedIds).toEqual([])
  })
  it('no price at all: flagged missing, counted 0; NW leaves gold out and is marked incomplete (136,000)', () => {
    useFinanceStore.setState({ goldPriceAvailable: false, lastGoldFetch: null })
    const d = computeGoalProgressDetail(goal$('wedding'), ctx())
    expect(d).toMatchObject({ amount: 0, priceMissing: 'gold', stalePrice: null })
    const r = nw(false)
    expect(r.netWorth).toBe(136000)
    expect(r.netWorthIncomplete).toBe(true)
  })
  it('a non-gold part with no rate is flagged as a missing price, not gold', () => {
    useFinanceStore.setState((s) => ({ savingsAccounts: [...s.savingsAccounts, part('carBtc', 0.1, { currency: 'BTC', type: 'crypto', goalId: 'car' })] }))
    expect(computeGoalProgressDetail(goal$('car'), ctx())).toEqual({ amount: 30000, stalePrice: null, priceMissing: 'other' })
  })
  it('fresh price: no warning', () => {
    expect(computeGoalProgressDetail(goal$('wedding'), ctx())).toMatchObject({ amount: 35000, stalePrice: null, priceMissing: null })
  })
})

describe('T45: Monthly savings is undeletable', () => {
  it("delete → {ok:false, reason:'system'}; rename OK", () => {
    expect(canDeletePocket(S(), 'ms')).toEqual({ ok: false, reason: 'system' })
    S().updateSavingsAccount('ms', { name: 'My monthly' })
    expect(S().savingsAccounts.find((p) => p.id === 'ms')?.name).toBe('My monthly')
  })
})

describe('no change for goals without parts or labels', () => {
  it('no parts and nothing listed: the manual amount', () => {
    useFinanceStore.setState((s) => ({ goals: [...s.goals, goal('manual', 5000, 5, [], { manualCurrentAmount: 1200 })] }))
    expect(progress('manual')).toBe(1200)
  })
  it('a legacy pocket the goal lists (no goalId, no home, no labels) counts whole', () => {
    useFinanceStore.setState((s) => ({
      savingsAccounts: [...s.savingsAccounts, part('legacy', 4000)],
      goals: [...s.goals, goal('old', 10000, 6, ['legacy'])],
    }))
    expect(computeGoalProgressDetail(goal$('old'), ctx())).toEqual({ amount: 4000, stalePrice: null, priceMissing: null })
  })
  it('a held part with no shortfall counts its whole balance', () => {
    expect(computeGoalProgressDetail(goal$('car'), ctx())).toEqual({ amount: 30000, stalePrice: null, priceMissing: null })
  })
})

describe('I-12 across copies: import and merge', () => {
  it('import keeps a locally achieved goal achieved; the rest of the row lands', async () => {
    const GID = '22222222-3333-4444-8555-666666666666'
    const g0 = { ...goal(GID, 1000, 7, []), emoji: '🎯', targetDate: null, monthlySpendingLimit: null, monthlyContribution: null, notes: null }
    useFinanceStore.setState({ goals: [g0] })
    S().achieveGoal(GID)
    const at = goal$(GID).achievedAt
    await S().importData(JSON.stringify({ version: 1, goals: [{ ...g0, status: 'active', achievedAt: null, name: 'Phone 2' }] }))
    expect(goal$(GID)).toMatchObject({ status: 'achieved', achievedAt: at, name: 'Phone 2' })
  })
  it('merge: an achieved copy wins over a newer active one, either side', () => {
    const base = goal('car', 150000, 1, [])
    const achieved = { ...base, status: 'achieved' as const, achievedAt: '2025-11-30T00:00:00.000Z', updatedAt: '2025-11-30T00:00:00.000Z' }
    const active = { ...base, name: 'Newer', updatedAt: '2025-12-02T00:00:00.000Z' }
    const lists = ['paymentMethods', 'incomeSources', 'incomeEvents', 'expenses', 'receipts', 'recurringExpenses', 'subscriptions', 'debts',
      'debtPayments', 'recurringDebtPayments', 'savingsAccounts', 'investmentHoldings', 'savingsTransactions', 'recurringSavingsDeposits',
      'budgetPlans', 'buddgyMemories', 'accountAdjustments', 'budgetPlanActivations']
    const snap = (goals: Goal[]) => ({ ...Object.fromEntries(lists.map((k) => [k, []])), goals }) as never
    for (const [l, s] of [[active, achieved], [achieved, active]]) {
      const [g] = mergeSnapshots(snap([l]), snap([s])).goals
      expect(g).toMatchObject({ status: 'achieved', achievedAt: '2025-11-30T00:00:00.000Z', name: 'Newer' })
    }
  })
})
