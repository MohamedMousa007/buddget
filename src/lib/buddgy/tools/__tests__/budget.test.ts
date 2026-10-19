import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import type { BudgetPlan, BudgetPlanCategory, Expense } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const ar: ToolContext = { ...ctx, locale: 'ar' }

const write = (name: string) => {
  const w = TOOLS.get(name)?.write
  if (!w) throw new Error(`no write tool ${name}`)
  return w
}
const read = (name: string, args: Record<string, unknown> = {}) => {
  const r = TOOLS.get(name)?.read
  if (!r) throw new Error(`no read tool ${name}`)
  return r(args, ctx) as BudgetRead
}

interface BudgetRead {
  plan: { ref: string; name: string } | null
  planned: number
  free: number
  lines: { ref: string; name: string; planned: number; spent?: number; left?: number; locked?: boolean; linked?: boolean }[]
  plans: { ref: string; name: string; status: string; active?: boolean; lines: number; planned: number }[]
}

const line = (id: string, name: string, amount: number, over: Partial<BudgetPlanCategory> = {}): BudgetPlanCategory => ({
  id,
  name,
  icon: 'wallet',
  amount,
  subcategories: [],
  block: 'everyday',
  linkType: 'none',
  linkIds: [],
  ...over,
})

const L_FOOD = 'a1a1a1a1-0000-0000-0000-000000000001'
const L_RENT = 'b2b2b2b2-0000-0000-0000-000000000002'
const L_DEBT = 'c3c3c3c3-0000-0000-0000-000000000003'
const L_FUN = 'd4d4d4d4-0000-0000-0000-000000000004'
const P1 = 'e5e5e5e5-0000-0000-0000-000000000005'
const P2 = 'f6f6f6f6-0000-0000-0000-000000000006'
const P3 = '17171717-0000-0000-0000-000000000007'

const plan = (id: string, name: string, over: Partial<BudgetPlan> = {}): BudgetPlan => ({
  id,
  name,
  createdAt: '2026-09-01T00:00:00.000Z',
  status: 'ready',
  incomeOverride: 10000,
  categories: [
    line(L_FOOD, 'Food', 2000),
    line(L_RENT, 'Rent', 4000, { block: 'bills', locked: true }),
    line(L_DEBT, 'Debt minimums', 1000, { block: 'debts', linkType: 'debts', linkIds: [] }),
    line(L_FUN, 'Fun', 500),
  ],
  ...over,
})

const lunch: Expense = {
  id: '99999999-0000-0000-0000-000000000009',
  date: '2026-10-10',
  description: 'Lunch',
  category: 'Food',
  amount: 300,
  currency: 'EGP',
  amountInBaseCurrency: 300,
  paymentMethodId: '',
  isRecurring: false,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
}

const state = () => useFinanceStore.getState()
const lines = () => state().budgetPlans.find((p) => p.id === P1)!.categories

beforeEach(() => {
  useSettingsStore.setState({ monthFilter: '2026-10' })
  useFinanceStore.setState({
    budgetPlans: [plan(P1, 'October plan'), plan(P2, 'Saver plan'), plan(P3, 'Draft plan', { status: 'draft' })],
    budgetPlanActivations: [],
    activeBudgetPlanId: P1,
    expenses: [lunch],
    incomeSources: [],
    incomeEvents: [],
    debts: [],
    debtPayments: [],
    exchangeRates: {},
    settings: { ...state().settings, baseCurrency: 'EGP', monthStartDay: 1, noIncomeDeclared: false },
  })
})

describe('get_budget', () => {
  it('lists lines with refs, spend and flags', () => {
    const r = read('get_budget')
    expect(r.plan).toEqual({ ref: refOf(P1), name: 'October plan' })
    expect(r.planned).toBe(7500)
    expect(r.free).toBe(2500)
    const food = r.lines.find((l) => l.name === 'Food')
    expect(food).toMatchObject({ ref: refOf(L_FOOD), planned: 2000, spent: 300, left: 1700 })
    expect(r.lines.find((l) => l.name === 'Rent')?.locked).toBe(true)
    expect(r.lines.find((l) => l.name === 'Debt minimums')?.linked).toBe(true)
  })

  it('filters by block', () => {
    expect(read('get_budget', { block: 'bills' }).lines.map((l) => l.name)).toEqual(['Rent'])
  })

  it('says so without a plan', () => {
    useFinanceStore.setState({ budgetPlans: [], activeBudgetPlanId: null })
    expect(read('get_budget').plan).toBeNull()
  })
})

describe('list_budget_plans', () => {
  it('puts the active plan first', () => {
    const r = read('list_budget_plans')
    expect(r.plans[0]).toMatchObject({ ref: refOf(P1), active: true, lines: 4, planned: 7500 })
    expect(r.plans.find((p) => p.name === 'Draft plan')?.status).toBe('draft')
  })
})

describe('adjust_budget', () => {
  it('proposes without mutating, applies, and undoes', () => {
    const before = structuredClone(lines())
    const p = write('adjust_budget').propose(
      { ops: [{ op: 'set', line: 'Food', amount: 2500 }, { op: 'add', name: 'Gym', amount: 300, block: 'everyday' }, { op: 'lock', line: refOf(L_FUN) }] },
      ctx,
    )
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(lines()).toEqual(before)
    expect(p.proposal.summary).toMatch(/pending/i)
    const rows = p.proposal.preview.rows
    expect(rows).toContainEqual(expect.objectContaining({ label: 'Food', before: expect.stringContaining('2,000'), value: expect.stringContaining('2,500') }))
    expect(rows.some((r) => r.label === 'Gym')).toBe(true)
    expect(rows).toContainEqual({ label: 'Fun', value: 'Locked' })
    expect(p.proposal.preview.effect).toMatch(/left to assign/i)

    const applied = write('adjust_budget').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(lines().find((l) => l.id === L_FOOD)?.amount).toBe(2500)
    expect(lines().find((l) => l.name === 'Gym')).toMatchObject({ amount: 300, block: 'everyday', linkType: 'none' })
    expect(lines().find((l) => l.id === L_FUN)?.locked).toBe(true)

    if (applied.ok) applied.undo?.()
    expect(lines()).toEqual(before)
  })

  it('handles move, rename and remove, and undo restores removed lines under their original ids', () => {
    const before = structuredClone(lines())
    const p = write('adjust_budget').propose(
      { ops: [{ op: 'remove', line: 'Fun' }, { op: 'rename', line: 'Food', name: 'Groceries' }, { op: 'move', line: 'Food', block: 'bills' }] },
      ctx,
    )
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const applied = write('adjust_budget').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(lines().map((l) => l.name)).toEqual(['Groceries', 'Rent', 'Debt minimums'])
    expect(lines()[0].block).toBe('bills')
    if (!applied.ok) return
    applied.undo?.()
    const back = lines()
    expect(back.map((l) => l.name)).toEqual(before.map((l) => l.name))
    expect(back).toEqual(before)
    expect(back.find((l) => l.name === 'Fun')?.id).toBe(L_FUN)
  })

  it('undo keeps a line added after the adjustment and an unrelated later edit', () => {
    const p = write('adjust_budget').propose({ ops: [{ op: 'remove', line: 'Fun' }, { op: 'set', line: 'Food', amount: 1800 }] }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = write('adjust_budget').apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    const extra = line('aaaaaaaa-0000-0000-0000-00000000000a', 'Gifts', 100)
    state().replaceBudgetPlanCategories(P1, lines().map((l) => (l.id === L_DEBT ? { ...l, name: 'Debts' } : l)).concat(extra))
    applied.undo?.()
    expect(lines().find((l) => l.id === L_FUN)).toMatchObject({ name: 'Fun', amount: 500 })
    expect(lines().find((l) => l.id === L_FOOD)?.amount).toBe(2000)
    expect(lines().find((l) => l.id === L_DEBT)?.name).toBe('Debts')
    expect(lines().some((l) => l.id === extra.id)).toBe(true)
  })

  it('explains locked, linked and duplicate ops it skips', () => {
    const p = write('adjust_budget').propose(
      { ops: [{ op: 'set', line: 'Food', amount: 1800 }, { op: 'set', line: 'Rent', amount: 1 }, { op: 'set', line: 'Debt minimums', amount: 1 }, { op: 'add', name: 'food', amount: 5, block: 'everyday' }] },
      ctx,
    )
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const skipped = p.proposal.preview.rows.filter((r) => r.label === 'Skipped').map((r) => r.value)
    expect(skipped).toHaveLength(3)
    expect(skipped.join('|')).toMatch(/Rent · line is locked/)
    expect(skipped.join('|')).toMatch(/Debt minimums · line is linked/)
    expect(skipped.join('|')).toMatch(/food · name already used/)
    expect(p.proposal.summary).toMatch(/Skipped/)
    const applied = write('adjust_budget').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(lines().find((l) => l.id === L_RENT)?.amount).toBe(4000)
  })

  it('fails when nothing can apply', () => {
    const p = write('adjust_budget').propose({ ops: [{ op: 'set', line: 'Rent', amount: 1 }] }, ctx)
    expect(p).toMatchObject({ ok: false, error: 'Nothing could be changed.', hint: expect.stringContaining('locked') })
  })

  it('fails on a no-op, bad ops and unknown lines', () => {
    expect(write('adjust_budget').propose({ ops: [{ op: 'set', line: 'Food', amount: 2000 }] }, ctx)).toMatchObject({ ok: false, error: 'Nothing would change.' })
    expect(write('adjust_budget').propose({ ops: [] }, ctx).ok).toBe(false)
    expect(write('adjust_budget').propose({ ops: [{ op: 'set', line: 'Food' }] }, ctx).ok).toBe(false)
    expect(write('adjust_budget').propose({ ops: [{ op: 'add', name: 'X', amount: 1 }] }, ctx).ok).toBe(false)
    expect(write('adjust_budget').propose({ ops: [{ op: 'explode', line: 'Food' }] }, ctx).ok).toBe(false)
    const unknown = write('adjust_budget').propose({ ops: [{ op: 'set', line: 'Fod', amount: 5 }] }, ctx)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.choices?.map((c) => c.label)).toContain('Food')
  })

  it('does not guess on a name match across lines', () => {
    useFinanceStore.setState({
      budgetPlans: [plan(P1, 'October plan', { categories: [line(L_FOOD, 'Misc', 1), line(L_FUN, 'misc', 2)] })],
    })
    const r = write('adjust_budget').propose({ ops: [{ op: 'set', line: 'MISC', amount: 5 }] }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices).toHaveLength(2)
  })

  it('rejects a mis-scaled amount through the ops guard', () => {
    const r = write('adjust_budget').propose({ ops: [{ op: 'set', line: 'Food', amount: 9_999_999 }] }, ctx)
    expect(r).toMatchObject({ ok: false, error: 'Nothing could be changed.' })
  })

  it('rejects a stale proposal when the plan moved on', () => {
    const p = write('adjust_budget').propose({ ops: [{ op: 'set', line: 'Food', amount: 2500 }] }, ctx)
    if (!p.ok) throw new Error('expected proposal')
    state().replaceBudgetPlanCategories(P1, lines().map((l) => (l.id === L_FOOD ? { ...l, amount: 2100 } : l)))
    expect(write('adjust_budget').apply(p.proposal, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/changed since/) })
    expect(lines().find((l) => l.id === L_FOOD)?.amount).toBe(2100)
  })

  it('rejects a stale proposal when the line got locked or deleted', () => {
    const p = write('adjust_budget').propose({ ops: [{ op: 'set', line: 'Food', amount: 2500 }] }, ctx)
    if (!p.ok) throw new Error('expected proposal')
    state().replaceBudgetPlanCategories(P1, lines().map((l) => (l.id === L_FOOD ? { ...l, locked: true } : l)))
    expect(write('adjust_budget').apply(p.proposal, ctx).ok).toBe(false)
    state().replaceBudgetPlanCategories(P1, lines().filter((l) => l.id !== L_FOOD))
    expect(write('adjust_budget').apply(p.proposal, ctx).ok).toBe(false)
  })

  it('fails without an active plan and localizes the preview', () => {
    const p = write('adjust_budget').propose({ ops: [{ op: 'lock', line: 'Food' }, { op: 'move', line: 'Fun', block: 'goals' }] }, ar)
    expect(p.ok).toBe(true)
    if (p.ok) {
      expect(p.proposal.preview.title).toMatch(/تعديل الميزانية/)
      expect(p.proposal.preview.rows.map((r) => r.value)).toContain('مقفل')
      expect(p.proposal.preview.rows.map((r) => r.value)).toContain('الأهداف')
    }
    useFinanceStore.setState({ budgetPlans: [], activeBudgetPlanId: null })
    expect(write('adjust_budget').propose({ ops: [{ op: 'lock', line: 'Food' }] }, ctx).ok).toBe(false)
  })
})

describe('activate_budget_plan', () => {
  it('proposes a comparison, activates, and undoes', () => {
    const p = write('activate_budget_plan').propose({ plan: 'Saver plan' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.risk).toBe('strong')
    expect(p.proposal.preview.rows[0]).toMatchObject({ label: 'Plan', before: 'October plan', value: 'Saver plan' })
    expect(state().activeBudgetPlanId).toBe(P1)

    const applied = write('activate_budget_plan').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().activeBudgetPlanId).toBe(P2)
    expect(state().budgetPlanActivations.at(-1)).toMatchObject({ planId: P2, effectiveFrom: '2026-10-01' })

    if (applied.ok) applied.undo?.()
    expect(state().activeBudgetPlanId).toBe(P1)
    expect(state().budgetPlanActivations).toEqual([])
  })

  it('refuses the active plan, drafts and unknown or ambiguous names', () => {
    expect(write('activate_budget_plan').propose({ plan: refOf(P1) }, ctx)).toMatchObject({ ok: false, error: 'That plan is already active.' })
    expect(write('activate_budget_plan').propose({ plan: 'Draft plan' }, ctx).ok).toBe(false)
    const none = write('activate_budget_plan').propose({ plan: 'Saver' }, ctx)
    expect(none.ok).toBe(false)
    if (!none.ok) expect(none.choices?.length).toBe(3)
    useFinanceStore.setState({ budgetPlans: [plan(P1, 'Same'), plan(P2, 'same')] })
    const many = write('activate_budget_plan').propose({ plan: 'SAME' }, ctx)
    expect(many).toMatchObject({ ok: false, error: 'Several plans match.' })
  })

  it('rejects when the plan was deleted before approval', () => {
    const p = write('activate_budget_plan').propose({ plan: 'Saver plan' }, ctx)
    if (!p.ok) throw new Error('expected proposal')
    state().deleteBudgetPlan(P2)
    expect(write('activate_budget_plan').apply(p.proposal, ctx).ok).toBe(false)
    expect(state().activeBudgetPlanId).toBe(P1)
  })
})

describe('delete_budget_plan', () => {
  it('is strong, names the fallback, deletes, and can be undone', () => {
    const p = write('delete_budget_plan').propose({ plan: refOf(P1) }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.risk).toBe('strong')
    expect(p.proposal.preview.tone).toBe('danger')
    expect(p.proposal.preview.effect).toMatch(/Saver plan becomes the active plan/)
    expect(state().budgetPlans).toHaveLength(3)

    const applied = write('delete_budget_plan').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.undo).toBeTypeOf('function')
    expect(state().budgetPlans.map((x) => x.id)).toEqual([P2, P3])
    expect(state().activeBudgetPlanId).toBe(P2)
  })

  it('undo restores the plan, the active plan and the activation records', () => {
    const log = [
      { id: 'a0a0a0a0-0000-0000-0000-000000000001', planId: P1, effectiveFrom: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'a0a0a0a0-0000-0000-0000-000000000002', planId: P2, effectiveFrom: '2026-08-01', createdAt: '2026-08-01T00:00:00.000Z' },
    ]
    useFinanceStore.setState({ budgetPlanActivations: log })
    const pre = structuredClone({ plans: state().budgetPlans, active: state().activeBudgetPlanId, log: state().budgetPlanActivations })
    const p = write('delete_budget_plan').propose({ plan: refOf(P1) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = write('delete_budget_plan').apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    expect(state().budgetPlanActivations.some((a) => a.planId === P1)).toBe(false)
    expect(applied.undo).toBeTypeOf('function')
    applied.undo?.()
    expect({ plans: state().budgetPlans, active: state().activeBudgetPlanId, log: state().budgetPlanActivations }).toEqual(pre)
  })

  it('undo does not discard a plan created after the delete', () => {
    const p = write('delete_budget_plan').propose({ plan: refOf(P1) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = write('delete_budget_plan').apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    useFinanceStore.setState({ budgetPlans: [...state().budgetPlans, plan('bbbbbbbb-0000-0000-0000-00000000000b', 'New')] })
    applied.undo?.()
    expect(state().budgetPlans.map((x) => x.id).sort()).toEqual([P1, P2, P3, 'bbbbbbbb-0000-0000-0000-00000000000b'].sort())
  })

  it('fails on unknown plans and when it vanished before approval', () => {
    expect(write('delete_budget_plan').propose({ plan: 'nope' }, ctx).ok).toBe(false)
    const p = write('delete_budget_plan').propose({ plan: refOf(P2) }, ctx)
    if (!p.ok) throw new Error('expected proposal')
    state().deleteBudgetPlan(P2)
    expect(write('delete_budget_plan').apply(p.proposal, ctx).ok).toBe(false)
  })
})
