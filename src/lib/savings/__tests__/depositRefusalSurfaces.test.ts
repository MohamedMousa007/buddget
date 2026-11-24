import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { buildAIActionHandlerContext, executeActionItem, validateActionItem } from '@/lib/ai/aiActionHandlers'
import { postDueRecurringSavings } from '@/lib/savings/postRecurringSavings'
import { useSkippedInstalments } from '@/lib/savings/skippedInstalments'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal, PaymentMethod, SavingsAccount } from '@/lib/store/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const H = 'a1a1a1a1-0000-0000-0000-000000000001'
const TRIP = 'b2b2b2b2-0000-0000-0000-000000000002'
const USD = 'c3c3c3c3-0000-0000-0000-000000000003'
const GOAL = 'd4d4d4d4-0000-0000-0000-000000000004'
const OUT = 'e5e5e5e5-0000-0000-0000-000000000005'

const S = () => useFinanceStore.getState()
const bank: PaymentMethod = { id: H, name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2020-01-01', openingBalance: 10000, openingAt: '2020-01-01T00:00:00.000Z' } as PaymentMethod
const pocket = (id: string, over: Partial<SavingsAccount>): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 0, createdAt: '2020-01-01', ...over }) as SavingsAccount
const write = (name: string) => TOOLS.get(name)!.write!
const rows = () => S().savingsTransactions.length

beforeEach(() =>
  useFinanceStore.setState({
    paymentMethods: [bank],
    savingsAccounts: [pocket(TRIP, { name: 'Trip', currentBalance: 3000, heldInPaymentMethodId: H }), pocket(USD, { name: 'Dollars', currency: 'USD' }), pocket(OUT, { name: 'Outside' })],
    savingsTransactions: [], recurringSavingsDeposits: [], incomeEvents: [], incomeSources: [], expenses: [], goals: [], debts: [], debtPayments: [], accountAdjustments: [],
    investmentHoldings: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
    settings: { ...S().settings, baseCurrency: 'EGP', showAllCurrenciesInForms: true },
  }),
)

describe('Buddgy never reports money that did not move', () => {
  it('deposit_to_savings explains a reserve above what the account has available', () => {
    const p = write('deposit_to_savings').propose({ pocket: refOf(TRIP), amount: 7001 }, ctx)
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.error).toContain('CIB')
    expect(rows()).toBe(0)
  })

  it('deposit_to_savings explains outside money aimed at a reserved pocket', () => {
    const p = write('deposit_to_savings').propose({ pocket: refOf(TRIP), amount: 500, mode: 'declare' }, ctx)
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.error).toContain('outside money')
  })

  it('deposit_to_savings explains a budget deposit no account can fund, and accepts it as declared money', () => {
    const refused = write('deposit_to_savings').propose({ pocket: refOf(USD), amount: 10, currency: 'USD' }, ctx)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.hint).toContain('declare')
    const p = write('deposit_to_savings').propose({ pocket: refOf(USD), amount: 10, currency: 'USD', mode: 'declare' }, ctx)
    expect(p.ok).toBe(true)
    if (p.ok) expect(write('deposit_to_savings').apply(p.proposal, ctx).ok).toBe(true)
    expect(S().savingsAccounts.find((a) => a.id === USD)!.currentBalance).toBe(10)
  })

  it('a deposit inside the cap is approved and applied', () => {
    const p = write('deposit_to_savings').propose({ pocket: refOf(TRIP), amount: 7000 }, ctx)
    expect(p.ok).toBe(true)
    if (p.ok) expect(write('deposit_to_savings').apply(p.proposal, ctx).ok).toBe(true)
    expect(S().savingsAccounts.find((a) => a.id === TRIP)!.currentBalance).toBe(10000)
  })

  it('an approval that went stale fails at apply instead of reporting success', () => {
    const p = write('deposit_to_savings').propose({ pocket: refOf(TRIP), amount: 7000 }, ctx)
    expect(p.ok).toBe(true)
    S().correctSavingsBalance(TRIP, 9000)
    if (p.ok) expect(write('deposit_to_savings').apply(p.proposal, ctx).ok).toBe(false)
    expect(S().savingsAccounts.find((a) => a.id === TRIP)!.currentBalance).toBe(9000)
  })

  it('correct_savings_balance explains a raise above what the account has available', () => {
    const p = write('correct_savings_balance').propose({ pocket: refOf(TRIP), balance: 10001 }, ctx)
    expect(p.ok).toBe(false)
    expect(write('correct_savings_balance').propose({ pocket: refOf(TRIP), balance: 10000 }, ctx).ok).toBe(true)
    expect(write('correct_savings_balance').propose({ pocket: refOf(TRIP), balance: 10 }, ctx).ok).toBe(true)
  })

  it('add_to_goal explains a refusal for the goal pocket', () => {
    const goal = { id: GOAL, name: 'Trip', emoji: 'x', category: 'travel', targetAmount: 50000, currency: 'EGP', manualCurrentAmount: 0, targetDate: '2027-10-01',
      linkedSavingsAccountIds: [TRIP], linkedDebtIds: [], monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: null, fundingMode: 'manual',
      sharePct: null, frequency: 'monthly', planStart: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z', achievedAt: null } as unknown as Goal
    useFinanceStore.setState({ goals: [goal] })
    expect(write('add_to_goal').propose({ goal: refOf(GOAL), amount: 8000 }, ctx).ok).toBe(false)
    expect(write('add_to_goal').propose({ goal: refOf(GOAL), amount: 500, mode: 'declare' }, ctx).ok).toBe(false)
    expect(write('add_to_goal').propose({ goal: refOf(GOAL), amount: 500 }, ctx).ok).toBe(true)
  })
})

describe('a pocket outside the accounts is funded from the account, never beyond what it has free (CIB 7,000)', () => {
  const goalFor = (pocketId: string) => ({ id: GOAL, name: 'Car', emoji: 'x', category: 'travel', targetAmount: 50000, currency: 'EGP', manualCurrentAmount: 0, targetDate: '2027-10-01',
    linkedSavingsAccountIds: [pocketId], linkedDebtIds: [], monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: null, fundingMode: 'manual',
    sharePct: null, frequency: 'monthly', planStart: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z', achievedAt: null }) as unknown as Goal

  it('deposit_to_savings is refused naming the account, and applied inside the cap', () => {
    const refused = write('deposit_to_savings').propose({ pocket: refOf(OUT), amount: 7001 }, ctx)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error).toContain('CIB only has 7000 EGP available')
    const p = write('deposit_to_savings').propose({ pocket: refOf(OUT), amount: 7000 }, ctx)
    expect(p.ok).toBe(true)
    if (p.ok) expect(write('deposit_to_savings').apply(p.proposal, ctx).ok).toBe(true)
    expect(S().savingsAccounts.find((a) => a.id === OUT)!.currentBalance).toBe(7000)
  })

  it('add_to_goal is refused naming the account', () => {
    useFinanceStore.setState({ goals: [goalFor(OUT)] })
    const refused = write('add_to_goal').propose({ goal: refOf(GOAL), amount: 7001 }, ctx)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error).toContain('CIB only has 7000 EGP available')
    expect(write('add_to_goal').propose({ goal: refOf(GOAL), amount: 7000 }, ctx).ok).toBe(true)
    expect(rows()).toBe(0)
  })

  it('the voice and chat handler fails validation naming the account', () => {
    const c = buildAIActionHandlerContext(S())
    expect(validateActionItem(c, 'deposit_savings', { account: 'Outside', amount: 7001 })).toContain('CIB only has 7000 EGP available')
    expect(validateActionItem(c, 'deposit_savings', { account: 'Outside', amount: 7000 })).toBeNull()
  })

  it('a recurring deposit above the free money is skipped with its notice, moves on, and never leaves a negative balance', () => {
    useSkippedInstalments.setState({ skipped: [] })
    useFinanceStore.setState({
      recurringSavingsDeposits: [{ id: 'r2', accountId: OUT, amount: 8000, currency: 'EGP', dayOfMonth: 1, nextDueDate: '2026-11-01', isActive: true, createdAt: '2026-01-01' }] as never,
    })
    postDueRecurringSavings('2026-11-01')
    expect(rows()).toBe(0)
    expect(S().savingsAccounts.find((a) => a.id === OUT)!.currentBalance).toBe(0)
    expect(S().recurringSavingsDeposits[0].nextDueDate).toBe('2026-12-01')
    expect(useSkippedInstalments.getState().skipped).toEqual([expect.objectContaining({ ruleId: 'r2', due: '2026-11-01', pocketName: 'Outside', amount: 8000 })])
  })
})

describe('the voice and chat action handler reports a refused deposit', () => {
  it('deposit_savings fails validation with the reason', () => {
    const c = buildAIActionHandlerContext(S())
    expect(validateActionItem(c, 'deposit_savings', { account: 'Trip', amount: 7001 })).toContain('CIB')
    expect(validateActionItem(c, 'deposit_savings', { account: 'Dollars', amount: 10, currency: 'USD' })).toContain('USD')
    expect(validateActionItem(c, 'deposit_savings', { account: 'Trip', amount: 100 })).toBeNull()
  })

  it('add_savings_holding is refused before an empty pocket is created', () => {
    const c = buildAIActionHandlerContext(S())
    expect(validateActionItem(c, 'add_savings_holding', { name: 'Euro stash', amount: 100, currency: 'USD' })).toContain('USD')
    expect(S().savingsAccounts).toHaveLength(3)
    expect(validateActionItem(c, 'add_savings_holding', { name: 'Rainy day', amount: 100, currency: 'EGP' })).toBeNull()
    executeActionItem(c, 'add_savings_holding', { name: 'Rainy day', amount: 100, currency: 'EGP' })
    expect(S().savingsAccounts.find((a) => a.name === 'Rainy day')!.currentBalance).toBe(100)
  })
})

describe('recurring savings the store would refuse', () => {
  beforeEach(() => useSkippedInstalments.setState({ skipped: [] }))
  const recurring = (accountId: string, amount: number, currency: string) =>
    useFinanceStore.setState({
      recurringSavingsDeposits: [{ id: 'r1', accountId, amount, currency, dayOfMonth: 1, nextDueDate: '2026-11-01', isActive: true, createdAt: '2026-01-01' }] as never,
    })

  it('above what a reserved pocket\'s account has free: that month is skipped, moves on, and the user is told', () => {
    recurring(TRIP, 8000, 'EGP')
    postDueRecurringSavings('2026-11-01')
    expect(rows()).toBe(0)
    expect(S().recurringSavingsDeposits[0].nextDueDate).toBe('2026-12-01')
    expect(useSkippedInstalments.getState().skipped).toEqual([expect.objectContaining({ ruleId: 'r1', due: '2026-11-01', pocketName: 'Trip', amount: 8000 })])
    postDueRecurringSavings('2026-11-02')
    expect(useSkippedInstalments.getState().skipped).toHaveLength(1)
  })

  it('no account in the pocket\'s currency: posted as new money, no account debited', () => {
    recurring(USD, 100, 'USD')
    postDueRecurringSavings('2026-11-01')
    const tx = S().savingsTransactions[0]
    expect(tx.paymentMethodId).toBeUndefined()
    expect(tx.isCashFlow).toBe(false)
    expect(S().savingsAccounts.find((a) => a.id === USD)!.currentBalance).toBe(100)
    expect(S().recurringSavingsDeposits[0].nextDueDate).toBe('2026-12-01')
    expect(useSkippedInstalments.getState().skipped).toHaveLength(0)
  })
})
