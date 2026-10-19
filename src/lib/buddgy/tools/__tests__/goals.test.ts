import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal, SavingsAccount } from '@/lib/store/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const ctxAr: ToolContext = { now: ctx.now, locale: 'ar' }

const G1 = 'a1a1a1a1-0000-0000-0000-000000000001'
const G2 = 'b2b2b2b2-0000-0000-0000-000000000002'
const G3 = 'c3c3c3c3-0000-0000-0000-000000000003'
const P1 = 'd4d4d4d4-0000-0000-0000-000000000004'
const P2 = 'e5e5e5e5-0000-0000-0000-000000000005'

const pocket = (id: string, over: Partial<SavingsAccount> = {}): SavingsAccount => ({
  id,
  name: 'Car pocket',
  category: 'savings',
  type: 'vault',
  currency: 'EGP',
  currentBalance: 300,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const goal = (id: string, over: Partial<Goal> = {}): Goal => ({
  id,
  name: 'Car',
  emoji: '🚗',
  category: 'car',
  targetAmount: 1000,
  currency: 'EGP',
  manualCurrentAmount: 0,
  targetDate: '2027-10-01',
  linkedSavingsAccountIds: [P1],
  linkedDebtIds: [],
  monthlySpendingLimit: null,
  priority: 0,
  status: 'active',
  monthlyContribution: null,
  fundingMode: 'manual',
  sharePct: null,
  frequency: 'monthly',
  planStart: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  achievedAt: null,
  ...over,
})

const write = (name: string) => {
  const w = TOOLS.get(name)?.write
  if (!w) throw new Error(`no write tool ${name}`)
  return w
}
const read = (name: string, args: Record<string, unknown> = {}) => {
  const r = TOOLS.get(name)?.read
  if (!r) throw new Error(`no read tool ${name}`)
  return r(args, ctx) as Record<string, unknown>
}
const st = () => useFinanceStore.getState()

beforeEach(() => {
  useFinanceStore.setState({
    goals: [goal(G1), goal(G2, { name: 'Trip', category: 'vacation', targetAmount: 5000, linkedSavingsAccountIds: [P2], priority: 1 })],
    savingsAccounts: [pocket(P1), pocket(P2, { name: 'Trip pocket', currentBalance: 0 })],
    savingsTransactions: [],
    recurringSavingsDeposits: [],
    incomeEvents: [],
    debts: [],
    debtPayments: [],
    expenses: [],
    exchangeRates: {},
    settings: { ...st().settings, baseCurrency: 'EGP', showAllCurrenciesInForms: false },
  })
})

describe('list_goals', () => {
  it('returns refs, live progress from the linked pocket and the funding mode', () => {
    const r = read('list_goals') as { rows: Record<string, unknown>[] }
    expect(r.rows[0]).toMatchObject({ ref: refOf(G1), name: 'Car', target: 1000, saved: 300, pct: 30, funding: 'manual', date: '2027-10-01' })
    expect(r.rows[0].need_mo).toBe(Math.round(700 / 12))
    expect(r.rows[1]).toMatchObject({ name: 'Trip', saved: 0, pct: 0 })
  })

  it('flags an overdue goal and lists achieved goals last', () => {
    useFinanceStore.setState({ goals: [goal(G1, { targetDate: '2026-09-01', status: 'achieved' }), goal(G2, { name: 'Trip', targetDate: '2026-09-01' })] })
    const rows = (read('list_goals') as { rows: Record<string, unknown>[] }).rows
    expect(rows.map((x) => x.name)).toEqual(['Trip', 'Car'])
    expect(rows[0].flag).toBe('overdue')
    expect(rows[1].flag).toBeUndefined()
  })

  it('caps at 15 rows and reports the rest', () => {
    useFinanceStore.setState({ goals: Array.from({ length: 17 }, (_, i) => goal(`${i.toString(16).padStart(2, '0')}${'f'.repeat(6)}-0000-0000-0000-000000000000`, { priority: i })) })
    const r = read('list_goals') as { rows: unknown[]; more?: number }
    expect(r.rows).toHaveLength(15)
    expect(r.more).toBe(2)
  })
})

describe('add_goal', () => {
  it('proposes without mutating, then creates the goal, its pocket and the opening deposit, and undoes', () => {
    const p = write('add_goal').propose({ name: 'Wedding', target: 20000, date: '2027-06-01', category: 'wedding', saved: 500 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.risk).toBe('approve')
    expect(p.proposal.summary).toMatch(/^Pending approval/)
    expect(st().goals).toHaveLength(2)

    const applied = write('add_goal').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    const g = st().goals.find((x) => x.name === 'Wedding')!
    expect(g).toMatchObject({ targetAmount: 20000, targetDate: '2027-06-01', fundingMode: 'manual', frequency: 'monthly', priority: 2, category: 'wedding', status: 'active' })
    const pk = st().savingsAccounts.find((a) => a.id === g.linkedSavingsAccountIds[0])!
    expect(pk).toMatchObject({ name: 'Wedding pocket', type: 'vault', currency: 'EGP', currentBalance: 500 })
    expect(st().savingsTransactions.at(-1)).toMatchObject({ accountId: pk.id, source: 'goal_opening', isCashFlow: false })

    if (applied.ok) applied.undo?.()
    expect(st().goals).toHaveLength(2)
    expect(st().savingsAccounts).toHaveLength(2)
    expect(st().savingsTransactions).toHaveLength(0)
  })

  it('rejects a bad target, a past date, a disabled currency, a debt category and negative saved', () => {
    const add = write('add_goal')
    expect(add.propose({ name: 'x', target: 0 }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', target: 5, date: '2026-10-19' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', target: 5, date: '2027-02-31' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', target: 5, currency: 'XAU' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', target: 5, category: 'debt_freedom' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', target: 5, saved: -1 }, ctx).ok).toBe(false)
    expect(add.propose({ name: '  ', target: 5 }, ctx).ok).toBe(false)
  })

  it('warns about a duplicate name and localizes the card', () => {
    const p = write('add_goal').propose({ name: 'car', target: 10 }, ctxAr)
    expect(p.ok && p.proposal.preview.effect).toContain('بهذا الاسم')
    expect(p.ok && p.proposal.preview.title).toBe('هدف جديد')
  })
})

describe('update_goal', () => {
  it('changes target and date, restarts the plan and undoes', () => {
    const upd = write('update_goal')
    const p = upd.propose({ goal: 'car', target: 2000, date: '2028-01-01' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.preview.rows.map((r) => r.label)).toEqual(['Target', 'Target date'])
    const applied = upd.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(st().goals.find((g) => g.id === G1)).toMatchObject({ targetAmount: 2000, targetDate: '2028-01-01', planStart: '2026-10-19' })
    if (applied.ok) applied.undo?.()
    expect(st().goals.find((g) => g.id === G1)).toMatchObject({ targetAmount: 1000, targetDate: '2027-10-01', planStart: null })
  })

  it('sets share funding and clears the other amounts', () => {
    useFinanceStore.setState({ goals: [goal(G1, { fundingMode: 'fixed', monthlyContribution: 100 })] })
    const upd = write('update_goal')
    const p = upd.propose({ goal: refOf(G1), funding: 'share', sharePct: 40 }, ctx)
    expect(p.ok).toBe(true)
    if (p.ok) upd.apply(p.proposal, ctx)
    expect(st().goals[0]).toMatchObject({ fundingMode: 'share', sharePct: 40, monthlyContribution: null })
  })

  it('validates funding combinations', () => {
    const upd = write('update_goal')
    expect(upd.propose({ goal: refOf(G1), funding: 'share' }, ctx).ok).toBe(false)
    expect(upd.propose({ goal: refOf(G1), funding: 'share', sharePct: 150 }, ctx).ok).toBe(false)
    expect(upd.propose({ goal: refOf(G1), funding: 'fixed' }, ctx).ok).toBe(false)
    expect(upd.propose({ goal: refOf(G1), sharePct: 20 }, ctx).ok).toBe(false)
    expect(upd.propose({ goal: refOf(G1), monthly: 100 }, ctx).ok).toBe(false)
  })

  it('fails on no-ops, past dates, unknown goals and debt-goal targets', () => {
    const upd = write('update_goal')
    expect(upd.propose({ goal: refOf(G1), target: 1000 }, ctx).ok).toBe(false)
    expect(upd.propose({ goal: refOf(G1), date: '2026-01-01' }, ctx).ok).toBe(false)
    expect(upd.propose({ goal: 'Boat', target: 5 }, ctx).ok).toBe(false)
    useFinanceStore.setState({ goals: [goal(G3, { name: 'Free', category: 'debt_freedom', linkedSavingsAccountIds: [] })] })
    expect(upd.propose({ goal: 'Free', target: 5 }, ctx).ok).toBe(false)
  })

  it('maps target to the monthly limit of a spending goal', () => {
    useFinanceStore.setState({ goals: [goal(G3, { name: 'Eat less', category: 'spending_control', targetAmount: null, monthlySpendingLimit: 3000, linkedSavingsAccountIds: [] })] })
    const upd = write('update_goal')
    const p = upd.propose({ goal: 'Eat less', target: 2500 }, ctx)
    expect(p.ok).toBe(true)
    if (p.ok) upd.apply(p.proposal, ctx)
    expect(st().goals[0].monthlySpendingLimit).toBe(2500)
  })

  it('says when the new target is already reached', () => {
    const p = write('update_goal').propose({ goal: 'Car', target: 250 }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/achieved/)
  })

  it('returns choices for a duplicate name and rejects a stale proposal', () => {
    useFinanceStore.setState({ goals: [goal(G1), goal(G2)] })
    const dup = write('update_goal').propose({ goal: 'Car', target: 5 }, ctx)
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.choices).toHaveLength(2)

    const p = write('update_goal').propose({ goal: refOf(G1), target: 5 }, ctx)
    useFinanceStore.setState({ goals: [goal(G2)] })
    expect(p.ok && write('update_goal').apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('add_to_goal', () => {
  it('deposits into the linked pocket as budget money and undoes', () => {
    const add = write('add_to_goal')
    const p = add.propose({ goal: 'Car', amount: 200 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.preview.rows.find((r) => r.label === 'Saved')).toMatchObject({ before: expect.any(String), value: expect.any(String) })
    expect(p.proposal.preview.effect).toMatch(/Left to spend drops/)
    const applied = add.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(st().savingsAccounts.find((a) => a.id === P1)?.currentBalance).toBe(500)
    expect(st().savingsTransactions.at(-1)).toMatchObject({ accountId: P1, type: 'deposit', amount: 200 })
    expect(st().savingsTransactions.at(-1)?.isCashFlow).toBeUndefined()

    if (applied.ok) applied.undo?.()
    expect(st().savingsAccounts.find((a) => a.id === P1)?.currentBalance).toBe(300)
    expect(st().savingsTransactions).toHaveLength(0)
  })

  it('declare mode is not cash flow', () => {
    const add = write('add_to_goal')
    const p = add.propose({ goal: 'Car', amount: 50, mode: 'declare' }, ctx)
    if (p.ok) add.apply(p.proposal, ctx)
    expect(st().savingsTransactions.at(-1)?.isCashFlow).toBe(false)
  })

  it('creates and links a pocket when the goal has none, and undo removes it again', () => {
    useFinanceStore.setState({ goals: [goal(G1, { linkedSavingsAccountIds: [] })], savingsAccounts: [] })
    const add = write('add_to_goal')
    const p = add.propose({ goal: 'Car', amount: 100 }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/pocket "Car pocket" is created/)
    if (!p.ok) return
    const applied = add.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(st().savingsAccounts).toHaveLength(1)
    expect(st().goals[0].linkedSavingsAccountIds).toEqual([st().savingsAccounts[0].id])
    expect(st().savingsAccounts[0].currentBalance).toBe(100)
    if (applied.ok) applied.undo?.()
    expect(st().savingsAccounts).toHaveLength(0)
    expect(st().goals[0].linkedSavingsAccountIds).toEqual([])
  })

  it('achieves the goal when it reaches the target and undo reopens it', () => {
    const add = write('add_to_goal')
    const p = add.propose({ goal: 'Car', amount: 700 }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/achieved/)
    if (!p.ok) return
    const applied = add.apply(p.proposal, ctx)
    expect(st().goals.find((g) => g.id === G1)?.status).toBe('achieved')
    if (applied.ok) applied.undo?.()
    expect(st().goals.find((g) => g.id === G1)).toMatchObject({ status: 'active', achievedAt: null })
    expect(st().savingsAccounts.find((a) => a.id === P1)?.currentBalance).toBe(300)
  })

  it('converts from another enabled currency and refuses when no rate exists', () => {
    useFinanceStore.setState({ exchangeRates: { USD_EGP: 50 }, settings: { ...st().settings, baseCurrency: 'EGP', showAllCurrenciesInForms: true } })
    const add = write('add_to_goal')
    const p = add.propose({ goal: 'Car', amount: 2, currency: 'USD' }, ctx)
    if (p.ok) add.apply(p.proposal, ctx)
    expect(st().savingsAccounts.find((a) => a.id === P1)?.currentBalance).toBe(400)
    expect(add.propose({ goal: 'Car', amount: 2, currency: 'KWD' }, ctx).ok).toBe(false)
  })

  it('refuses a currency the app has not enabled instead of letting the store clamp it', () => {
    expect(write('add_to_goal').propose({ goal: 'Car', amount: 2, currency: 'USD' }, ctx).ok).toBe(false)
  })

  it('rejects achieved goals, debt goals, bad amounts and bad modes', () => {
    const add = write('add_to_goal')
    useFinanceStore.setState({ goals: [goal(G1, { status: 'achieved' }), goal(G3, { name: 'Free', category: 'debt_freedom' })] })
    expect(add.propose({ goal: 'Car', amount: 5 }, ctx).ok).toBe(false)
    expect(add.propose({ goal: 'Free', amount: 5 }, ctx).ok).toBe(false)
    useFinanceStore.setState({ goals: [goal(G1)] })
    expect(add.propose({ goal: 'Car', amount: 0 }, ctx).ok).toBe(false)
    expect(add.propose({ goal: 'Car', amount: 5, mode: 'loan' }, ctx).ok).toBe(false)
    expect(add.propose({ goal: 'Nope', amount: 5 }, ctx).ok).toBe(false)
  })

  it('rejects a stale proposal when the goal is gone', () => {
    const add = write('add_to_goal')
    const p = add.propose({ goal: 'Car', amount: 5 }, ctx)
    useFinanceStore.setState({ goals: [] })
    expect(p.ok && add.apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('achieve_goal', () => {
  it('marks achieved and undo restores the previous status', () => {
    const ach = write('achieve_goal')
    const p = ach.propose({ goal: 'Trip' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const applied = ach.apply(p.proposal, ctx)
    expect(st().goals.find((g) => g.id === G2)).toMatchObject({ status: 'achieved' })
    expect(st().goals.find((g) => g.id === G2)?.achievedAt).toBeTruthy()
    if (applied.ok) applied.undo?.()
    expect(st().goals.find((g) => g.id === G2)).toMatchObject({ status: 'active', achievedAt: null })
  })

  it('refuses an already achieved goal', () => {
    useFinanceStore.setState({ goals: [goal(G1, { status: 'achieved' })] })
    expect(write('achieve_goal').propose({ goal: 'Car' }, ctx).ok).toBe(false)
  })
})

describe('delete_goal', () => {
  it('is strong, keeps the pocket and its money, and undoes with the same id', () => {
    const del = write('delete_goal')
    const p = del.propose({ goal: 'Car' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.risk).toBe('strong')
    expect(p.proposal.preview.tone).toBe('danger')
    expect(p.proposal.preview.rows.some((r) => r.value.includes('Car pocket'))).toBe(true)
    expect(p.proposal.preview.effect).toMatch(/stay in Wealth/)
    const applied = del.apply(p.proposal, ctx)
    expect(st().goals.map((g) => g.id)).toEqual([G2])
    expect(st().savingsAccounts.find((a) => a.id === P1)?.currentBalance).toBe(300)
    if (!applied.ok) return
    const pre = [goal(G1), goal(G2, { name: 'Trip', category: 'vacation', targetAmount: 5000, linkedSavingsAccountIds: [P2], priority: 1 })]
    st().updateGoal(G2, { notes: 'later edit' })
    applied.undo?.()
    expect(st().goals.find((g) => g.id === G1)).toEqual(pre[0])
    expect(st().goals.map((g) => g.id).sort()).toEqual([G1, G2].sort())
    expect(st().goals.find((g) => g.id === G2)?.notes).toBe('later edit')
  })

  it('rejects a stale delete', () => {
    const del = write('delete_goal')
    const p = del.propose({ goal: 'Car' }, ctx)
    useFinanceStore.setState({ goals: [] })
    expect(p.ok && del.apply(p.proposal, ctx).ok).toBe(false)
  })
})
