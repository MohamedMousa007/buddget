import { describe, expect, it } from 'vitest'
import { repairDraft } from '@/lib/budget/validate'
import type { DraftLine, PlanDraft } from '@/lib/budget/facts'

const L = (over: Partial<DraftLine> & { name: string; amount: number }): DraftLine => ({
  block: 'everyday', icon: 'wallet', linkType: 'none', linkIds: [], dueDay: null, essential: false,
  isSavings: false, expenseCategories: [], rationale: '', confidence: 'high', ...over,
})
const draft = (lines: DraftLine[], income = 10000): PlanDraft => ({
  name: 'Plan', intent: 'balanced', income, lines, reasons: [], risks: [], free: 0,
})
const ctx = { income: 10000, subscriptionsLive: 400, debtMinimums: { d1: 500 }, goalMonthly: { g1: 900 } }
const sum = (d: PlanDraft) => d.lines.reduce((s, l) => s + l.amount, 0)

describe('repairDraft', () => {
  it('renames duplicates to names that are really unique', () => {
    const r = repairDraft(draft([L({ name: 'Dining', amount: 100 }), L({ name: 'Dining 2', amount: 100 }), L({ name: 'Dining', amount: 100 })]), ctx)
    const names = r.draft.lines.map((l) => l.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
  it('sends the remainder to a buffer so the sum equals income', () => {
    const r = repairDraft(draft([L({ name: 'Rent', amount: 4000, block: 'bills' }), L({ name: 'Food', amount: 2000 })]), ctx)
    expect(r.ok).toBe(true)
    expect(sum(r.draft)).toBeCloseTo(10000, 2)
    expect(r.draft.lines.at(-1)).toMatchObject({ name: 'Buffer', amount: 4000, isSavings: true })
  })
  it('overwrites linked subscription and debt lines with live values and drops unknown refs', () => {
    const r = repairDraft(draft([
      L({ name: 'Subscriptions', amount: 1, block: 'subscriptions', linkType: 'subscriptions' }),
      L({ name: 'Card', amount: 1, block: 'debts', linkType: 'debts', linkIds: ['d1'] }),
      L({ name: 'Ghost debt', amount: 300, block: 'debts', linkType: 'debts', linkIds: ['zzz'] }),
    ]), ctx)
    expect(r.draft.lines.find((l) => l.name === 'Subscriptions')?.amount).toBe(400)
    expect(r.draft.lines.find((l) => l.name === 'Card')?.amount).toBe(500)
    expect(r.draft.lines.some((l) => l.name === 'Ghost debt')).toBe(false)
  })
  it('caps a goal above its live draw and flags a shortfall without blocking', () => {
    const high = repairDraft(draft([L({ name: 'Japan', amount: 5000, block: 'goals', linkType: 'goal', linkIds: ['g1'], isSavings: true })]), ctx)
    expect(high.draft.lines.find((l) => l.name === 'Japan')?.amount).toBe(900)
    const low = repairDraft(draft([L({ name: 'Japan', amount: 500, block: 'goals', linkType: 'goal', linkIds: ['g1'], isSavings: true })]), ctx)
    expect(low.issues).toEqual([{ code: 'goalShortfall', blocking: false, amount: 400 }])
    expect(low.ok).toBe(true)
  })
  it('clamps negatives and caps absurd lines', () => {
    const r = repairDraft(draft([L({ name: 'A', amount: -50 }), L({ name: 'B', amount: 9_999_999 })]), ctx)
    expect(r.draft.lines.every((l) => l.amount >= 0 && l.amount <= 100000)).toBe(true)
  })
  it('renames duplicates', () => {
    const r = repairDraft(draft([L({ name: 'Food', amount: 1 }), L({ name: 'food', amount: 1 })]), ctx)
    expect(new Set(r.draft.lines.map((l) => l.name.toLowerCase())).size).toBe(r.draft.lines.length)
  })
  it('trims savings then everyday (to 70%) when over-assigned, and never touches bills', () => {
    const r = repairDraft(draft([
      L({ name: 'Rent', amount: 6000, block: 'bills' }),
      L({ name: 'Food', amount: 3000 }),
      L({ name: 'Invest', amount: 2000, block: 'grow', isSavings: true }),
    ]), ctx)
    expect(r.ok).toBe(true)
    expect(r.draft.lines.find((l) => l.name === 'Rent')?.amount).toBe(6000)
    expect(sum(r.draft)).toBeCloseTo(10000, 1)
    expect(r.draft.lines.find((l) => l.name === 'Invest')!.amount).toBeLessThan(2000)
  })
  it('reports a blocking overAssigned when fixed costs alone exceed income', () => {
    const r = repairDraft(draft([L({ name: 'Rent', amount: 12000, block: 'bills' })]), ctx)
    expect(r.ok).toBe(false)
    expect(r.issues).toContainEqual({ code: 'overAssigned', blocking: true, amount: 2000 })
  })
  it('blocks when income is unknown', () => {
    expect(repairDraft(draft([], 0), { ...ctx, income: 0 }).issues[0].code).toBe('noIncome')
  })
  it('does not mutate its input', () => {
    const d = draft([L({ name: 'Food', amount: 2000 })])
    const snap = JSON.stringify(d)
    repairDraft(d, ctx)
    expect(JSON.stringify(d)).toBe(snap)
  })
})
