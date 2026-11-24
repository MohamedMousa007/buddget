import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { computeBalances } from '@/lib/accounts/balance'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { ledgerOf } from '@/lib/savings/pocketHome'
import { computeGoalProgress, buildGoalProgressContext } from '@/lib/goals/computeGoalProgress'
import { createGoalPocket, ELSEWHERE, goalHomeAccounts, savedHomeProblem } from './goalPocket'
import type { PaymentMethod } from '@/lib/store/types'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'

const S = () => useFinanceStore.getState()
const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2020-01-01', openingBalance: 100000, openingAt: '2020-01-01T00:00:00.000Z', ...over }) as PaymentMethod
const netWorth = () => {
  const s = S()
  return computeNetWorth({
    ...accountsBasisFor(ledgerOf(s), 'EGP'), savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: [], settings: s.settings,
    exchangeRates: s.exchangeRates, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining: 0,
  }).netWorth
}
const acct = (id: string) => computeBalances(ledgerOf(S())).get(id)!
const newGoal = () => S().addGoal({
  name: 'Car', emoji: 'x', category: 'car', currency: 'EGP', priority: 0, status: 'active', notes: null, targetAmount: 200000, targetDate: '2028-01-01',
  monthlySpendingLimit: null, linkedSavingsAccountIds: [], linkedDebtIds: [], fundingMode: 'manual', sharePct: null, monthlyContribution: null, frequency: 'monthly',
})
const make = (saved: number, home?: string | null) => createGoalPocket(S(), { goalId: newGoal(), pocketName: 'Car pocket', goalName: 'Car', currency: 'EGP', saved, home })
const progress = () => {
  const s = S()
  return computeGoalProgress(s.goals[0], buildGoalProgressContext(s, new Date().toISOString().slice(0, 7)))
}

beforeEach(() =>
  useFinanceStore.setState({
    paymentMethods: [
      pm('CIB'), pm('Cash', { type: 'cash', openingBalance: 4000 }), pm('Wallet', { type: 'wallet', openingBalance: 2500 }),
      pm('Dollars', { currency: 'USD' }), pm('NoBalance', { openingBalance: undefined, openingAt: undefined }),
      pm('Closed', { closedAt: '2026-01-01T00:00:00.000Z' }), pm('Hidden', { excluded: true }), pm('Card', { type: 'credit_card' }),
    ],
    savingsAccounts: [], savingsTransactions: [], incomeEvents: [], expenses: [], goals: [], debts: [], debtPayments: [], accountAdjustments: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 }, settings: { ...S().settings, baseCurrency: 'EGP' },
  }),
)

describe('"Where is this money?" for a goal\'s already-saved amount (QA bug 11)', () => {
  it('offers every tracked account in the goal currency, Cash and wallets included, and nothing else', () => {
    expect(goalHomeAccounts(S().paymentMethods, 'EGP').map((m) => m.id)).toEqual(['CIB', 'Cash', 'Wallet'])
    expect(goalHomeAccounts(S().paymentMethods, 'USD').map((m) => m.id)).toEqual(['Dollars'])
    expect(goalHomeAccounts(S().paymentMethods, 'EUR')).toEqual([])
  })

  it('must be answered when an account could hold the money, and is capped at what is available there', () => {
    const l = ledgerOf(S())
    expect(savedHomeProblem(l, 'EGP', 30000, null)).toBe('choose_home')
    expect(savedHomeProblem(l, 'EGP', 30000, 'Dollars')).toBe('choose_home')
    expect(savedHomeProblem(l, 'EGP', 30000, 'CIB')).toBeNull()
    expect(savedHomeProblem(l, 'EGP', 100000.5, 'CIB')).toBe('over_available')
    expect(savedHomeProblem(l, 'EGP', 4001, 'Cash')).toBe('over_available')
    expect(savedHomeProblem(l, 'EGP', 9e9, ELSEWHERE)).toBeNull()
    expect(savedHomeProblem(l, 'EGP', 0, null)).toBeNull()
    expect(savedHomeProblem(l, 'EUR', 500, null)).toBeNull()
  })

  it('in a tracked account: the pocket is set aside there and net worth does not change', () => {
    const before = netWorth()
    const { pocketId, savedRecorded } = make(30000, 'CIB')
    expect(savedRecorded).toBe(true)
    expect(S().savingsAccounts.find((p) => p.id === pocketId)).toMatchObject({ heldInPaymentMethodId: 'CIB', currentBalance: 30000, type: 'vault' })
    expect(S().savingsTransactions.at(-1)).toMatchObject({ source: 'goal_opening', isCashFlow: false, paymentMethodId: 'CIB' })
    expect(acct('CIB').balance).toBe(100000)
    expect(acct('CIB').free).toBe(70000)
    expect(netWorth()).toBe(before)
    expect(progress()).toBe(30000)
  })

  it('in the Cash account: set aside in Cash, never a second cash place', () => {
    const before = netWorth()
    const { pocketId } = make(1500, 'Cash')
    expect(S().savingsAccounts.find((p) => p.id === pocketId)!.heldInPaymentMethodId).toBe('Cash')
    expect(acct('Cash').free).toBe(2500)
    expect(netWorth()).toBe(before)
  })

  it('somewhere else: a pocket outside the accounts, net worth rises by the amount exactly once', () => {
    const before = netWorth()
    const { pocketId } = make(30000, ELSEWHERE)
    expect(S().savingsAccounts.find((p) => p.id === pocketId)!.heldInPaymentMethodId).toBeUndefined()
    expect(S().savingsTransactions.at(-1)!.paymentMethodId).toBeUndefined()
    expect(acct('CIB').balance).toBe(100000)
    expect(acct('CIB').free).toBe(100000)
    expect(netWorth()).toBe(before + 30000)
    expect(progress()).toBe(30000)
  })

  it('an amount above what the account has available is not recorded, and the caller is told', () => {
    const before = netWorth()
    const { pocketId, savedRecorded } = make(100001, 'CIB')
    expect(savedRecorded).toBe(false)
    expect(S().savingsAccounts.find((p) => p.id === pocketId)!.currentBalance).toBe(0)
    expect(netWorth()).toBe(before)
  })

  it('nothing saved: an empty pocket outside the accounts, as before', () => {
    const { pocketId, savedRecorded } = make(0, 'CIB')
    expect(savedRecorded).toBe(true)
    expect(S().savingsAccounts.find((p) => p.id === pocketId)).toMatchObject({ currentBalance: 0 })
    expect(S().savingsAccounts.find((p) => p.id === pocketId)!.heldInPaymentMethodId).toBeUndefined()
  })
})

describe('Buddgy add_goal asks the same question', () => {
  const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
  const tool = () => TOOLS.get('add_goal')!.write!
  const CIB = 'a1a1a1a1-0000-0000-0000-000000000001'
  const CASH = 'b2b2b2b2-0000-0000-0000-000000000002'
  beforeEach(() => useFinanceStore.setState({ paymentMethods: [pm(CIB, { name: 'CIB' }), pm(CASH, { name: 'Cash', type: 'cash', openingBalance: 4000 })] }))

  it('refuses to guess: with a saved amount and tracked accounts it returns the choices, accounts first, then somewhere else', () => {
    const p = tool().propose({ name: 'Car', target: 200000, saved: 30000 }, ctx)
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.choices?.map((c) => c.label)).toEqual(['CIB', 'Cash', 'Somewhere else (not tracked here)'])
    expect(S().goals).toHaveLength(0)
  })

  it('in an account: the goal pocket is set aside there and net worth is unchanged; undo removes everything', () => {
    const before = netWorth()
    const p = tool().propose({ name: 'Car', target: 200000, saved: 30000, saved_in: refOf(CIB) }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.preview.rows.some((r) => r.value === 'Set aside in CIB')).toBe(true)
    const applied = tool().apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(S().savingsAccounts[0]).toMatchObject({ heldInPaymentMethodId: CIB, currentBalance: 30000 })
    expect(acct(CIB).balance).toBe(100000)
    expect(acct(CIB).free).toBe(70000)
    expect(netWorth()).toBe(before)
    if (applied.ok) applied.undo?.()
    expect(S().goals).toHaveLength(0)
    expect(S().savingsAccounts).toHaveLength(0)
    expect(acct(CIB).free).toBe(100000)
    expect(netWorth()).toBe(before)
  })

  it('somewhere else: net worth rises by the saved amount once', () => {
    const before = netWorth()
    const p = tool().propose({ name: 'Car', target: 200000, saved: 30000, saved_in: 'elsewhere' }, ctx)
    expect(p.ok).toBe(true)
    if (p.ok) expect(tool().apply(p.proposal, ctx).ok).toBe(true)
    expect(S().savingsAccounts[0].heldInPaymentMethodId).toBeUndefined()
    expect(netWorth()).toBe(before + 30000)
  })

  it('more than the account has available is a tool failure, and nothing is created', () => {
    const p = tool().propose({ name: 'Car', target: 200000, saved: 5000, saved_in: 'Cash' }, ctx)
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.error).toContain('Cash')
    expect(S().goals).toHaveLength(0)
  })

  it('an approval that went stale fails at apply and leaves no goal behind', () => {
    const p = tool().propose({ name: 'Car', target: 200000, saved: 3000, saved_in: 'Cash' }, ctx)
    expect(p.ok).toBe(true)
    S().addSavingsAccount({ name: 'Other', category: 'savings', type: 'cash', currency: 'EGP', heldInPaymentMethodId: CASH, openingBalance: 3500 })
    if (p.ok) expect(tool().apply(p.proposal, ctx).ok).toBe(false)
    expect(S().goals).toHaveLength(0)
    expect(S().savingsAccounts).toHaveLength(1)
  })

  it('with no saved amount, or no tracked account, nothing is asked', () => {
    expect(tool().propose({ name: 'Car', target: 200000 }, ctx).ok).toBe(true)
    useFinanceStore.setState({ paymentMethods: [] })
    expect(tool().propose({ name: 'Car', target: 200000, saved: 500 }, ctx).ok).toBe(true)
  })
})

describe('J9: Buddgy never puts money the user placed in a tracked account "somewhere else"', () => {
  const QNB = 'c3c3c3c3-0000-0000-0000-000000000003'
  const CIB = 'a1a1a1a1-0000-0000-0000-000000000001'
  const tool = () => TOOLS.get('add_goal')!.write!
  const said = (...userTexts: string[]): ToolContext => ({ now: new Date('2026-10-19T12:00:00'), locale: 'en', userTexts })
  const goal = (saved: number, saved_in?: string) => ({ name: 'QA Car', target: 20000, currency: 'EGP', saved, ...(saved_in === undefined ? {} : { saved_in }) })
  const homeRow = (p: ReturnType<ReturnType<typeof tool>['propose']>) => (p.ok ? p.proposal.preview.rows.find((r) => r.label === 'Where it is')?.value : undefined)
  beforeEach(() => useFinanceStore.setState({
    paymentMethods: [pm(QNB, { name: 'QNB Alahli', openingBalance: 5000 }), pm(CIB, { name: 'CIB' }), pm('d4d4d4d4-0000-0000-0000-000000000004', { name: 'Cash', type: 'cash', openingBalance: 800 })],
  }))

  it('the model sends "elsewhere" but the user named QNB Alahli: the money is set aside in QNB, net worth unchanged', () => {
    const before = netWorth()
    const p = tool().propose(goal(3000, 'elsewhere'), said('make the already saved amount 3000 EGP instead, and it is in my QNB Alahli account'))
    expect(homeRow(p)).toBe('Set aside in QNB Alahli')
    if (!p.ok) return
    expect(p.proposal.args.saved_in).toBe(refOf(QNB))
    expect(tool().apply(p.proposal, { now: new Date('2026-10-19T12:00:00'), locale: 'en', revising: true }).ok).toBe(true)
    expect(S().savingsAccounts[0]).toMatchObject({ heldInPaymentMethodId: QNB, currentBalance: 3000 })
    expect(netWorth()).toBe(before)
  })

  it('more than QNB holds, the model sends "elsewhere": refused with what QNB has, and never invited to go elsewhere', () => {
    const p = tool().propose(goal(8000, 'elsewhere'), said('I already saved 8000 EGP for it and that money is in my QNB Alahli account.'))
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toContain('QNB Alahli')
    expect(p.error).toContain('5,000')
    expect(p.hint ?? '').not.toMatch(/somewhere else/i)
    expect(p.choices?.some((c) => c.id === 'elsewhere') ?? false).toBe(false)
    expect(S().goals).toHaveLength(0)
  })

  it('a close variant of the name, by the user or in saved_in, finds the account', () => {
    expect(homeRow(tool().propose(goal(3000, 'elsewhere'), said('it is in my QNB account')))).toBe('Set aside in QNB Alahli')
    expect(homeRow(tool().propose(goal(3000, 'elsewhere'), said('الفلوس في حساب qnb')))).toBe('Set aside in QNB Alahli')
    expect(homeRow(tool().propose(goal(3000, 'QNB'), said()))).toBe('Set aside in QNB Alahli')
    expect(homeRow(tool().propose(goal(300), said('it is all cash')))).toBe('Set aside in Cash')
  })

  it('no saved_in, the user named the account in an earlier message: resolved from it', () => {
    expect(homeRow(tool().propose(goal(3000), said('OK make it 3000 then', 'that money is in my QNB Alahli account')))).toBe('Set aside in QNB Alahli')
  })

  it('unclear: two accounts named, or an account and "somewhere else", asks with the choices', () => {
    for (const text of ['half in QNB and half in CIB', 'it was in QNB but now it is somewhere else']) {
      const p = tool().propose(goal(3000, 'elsewhere'), said(text))
      expect(p.ok).toBe(false)
      if (!p.ok) expect(p.choices?.map((c) => c.label)).toContain('QNB Alahli')
    }
  })

  it('"elsewhere" stays when the user names no tracked account, or says so', () => {
    expect(homeRow(tool().propose(goal(3000, 'elsewhere'), said('it is at my parents house')))).toBe('Somewhere else (not tracked here)')
    expect(homeRow(tool().propose(goal(3000, 'elsewhere'), said('somewhere else, not tracked here')))).toBe('Somewhere else (not tracked here)')
  })
})

describe('add_to_goal "money I already had": the same rule as a new goal', () => {
  const QNB = 'c3c3c3c3-0000-0000-0000-000000000003'
  const CIB = 'a1a1a1a1-0000-0000-0000-000000000001'
  const tool = () => TOOLS.get('add_to_goal')!.write!
  const said = (...userTexts: string[]): ToolContext => ({ now: new Date('2026-10-19T12:00:00'), locale: 'en', userTexts })
  const applyCtx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en', revising: true }
  const fund = (amount: number, saved_in?: string) => ({ goal: 'Car', amount, mode: 'declare', ...(saved_in === undefined ? {} : { saved_in }) })
  const homeRow = (p: ReturnType<ReturnType<typeof tool>['propose']>) => (p.ok ? p.proposal.preview.rows.find((r) => r.label === 'Where it is')?.value : undefined)
  beforeEach(() => {
    useFinanceStore.setState({
      paymentMethods: [pm(QNB, { name: 'QNB Alahli', openingBalance: 5000 }), pm(CIB, { name: 'CIB' })],
      savingsAccounts: [], savingsTransactions: [], goals: [],
    })
    newGoal()
  })

  it('the user names QNB, the model sends "elsewhere": set aside in QNB, net worth unchanged', () => {
    const before = netWorth()
    const p = tool().propose(fund(2000, 'elsewhere'), said('I already have 2000 in my QNB Alahli account for the car'))
    expect(homeRow(p)).toBe('Set aside in QNB Alahli')
    if (!p.ok) return
    expect(p.proposal.args.saved_in).toBe(refOf(QNB))
    expect(p.proposal.preview.effect).not.toMatch(/Net worth rises/)
    expect(tool().apply(p.proposal, applyCtx).ok).toBe(true)
    expect(S().savingsAccounts[0]).toMatchObject({ heldInPaymentMethodId: QNB, currentBalance: 2000 })
    expect(acct(QNB).free).toBe(3000)
    expect(netWorth()).toBe(before)
  })

  it('more than QNB has available is refused, with no "elsewhere" way out', () => {
    const p = tool().propose(fund(6000, 'elsewhere'), said('the 6000 is in QNB'))
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toContain('5,000')
    expect(p.choices?.some((c) => c.id === 'elsewhere') ?? false).toBe(false)
  })

  it('no saved_in and nothing named: asks, accounts first, then somewhere else', () => {
    const p = tool().propose(fund(2000), said('add 2000 I already had'))
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.choices?.map((c) => c.label)).toEqual(['QNB Alahli', 'CIB', 'Somewhere else (not tracked here)'])
  })

  it('"elsewhere" when the user names nothing tracked: outside, net worth rises once', () => {
    const before = netWorth()
    const p = tool().propose(fund(2000, 'elsewhere'), said('it was a gift, cash from my uncle at his house'))
    expect(homeRow(p)).toBe('Somewhere else (not tracked here)')
    if (p.ok) expect(tool().apply(p.proposal, applyCtx).ok).toBe(true)
    expect(netWorth()).toBe(before + 2000)
  })

  it('a pocket already set aside in QNB takes more QNB money; one held outside cannot', () => {
    const before = netWorth()
    const first = tool().propose(fund(1000, refOf(QNB)), said())
    if (first.ok) tool().apply(first.proposal, applyCtx)
    const again = tool().propose(fund(500, 'QNB'), said())
    expect(homeRow(again)).toBe('Set aside in QNB Alahli')
    if (again.ok) expect(tool().apply(again.proposal, applyCtx).ok).toBe(true)
    expect(S().savingsAccounts).toHaveLength(1)
    expect(S().savingsAccounts[0].currentBalance).toBe(1500)
    expect(netWorth()).toBe(before)
    expect(tool().propose(fund(500, refOf(CIB)), said()).ok).toBe(false)
  })

  it('"budget" money never asks where it is', () => {
    expect(tool().propose({ goal: 'Car', amount: 100 }, said()).ok).toBe(true)
  })
})

describe('the whole chat counts when the model sends "elsewhere"', () => {
  it('QNB named six user messages ago still wins over "elsewhere"', () => {
    const QNB = 'c3c3c3c3-0000-0000-0000-000000000003'
    useFinanceStore.setState({ paymentMethods: [pm(QNB, { name: 'QNB Alahli', openingBalance: 5000 })], goals: [], savingsAccounts: [] })
    const texts = ['ok', 'yes', 'the car one', 'sure', 'go on', 'my savings for it are in QNB Alahli']
    const p = TOOLS.get('add_goal')!.write!.propose({ name: 'Car', target: 9000, saved: 1000, saved_in: 'elsewhere' }, { now: new Date('2026-10-19T12:00:00'), locale: 'en', userTexts: texts })
    expect(p.ok && p.proposal.preview.rows.find((r) => r.label === 'Where it is')?.value).toBe('Set aside in QNB Alahli')
  })
})
