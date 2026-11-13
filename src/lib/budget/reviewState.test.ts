import { describe, expect, it } from 'vitest'
import type { BudgetBlock, BudgetPlan, BudgetPlanCategory } from '@/lib/store/types'
import type { PlanView } from '@/lib/budget/planView.types'
import { canActivate, flaggedBlocks, nextEmpty, nextFlagged, reviewSummary } from './reviewState'

const cat = (block: BudgetBlock, confidence?: 'high' | 'estimated'): BudgetPlanCategory =>
  ({ id: `${block}-${confidence}`, name: block, block, confidence }) as BudgetPlanCategory
const plan = (cats: BudgetPlanCategory[]) => ({ id: 'p', name: 'P', categories: cats }) as BudgetPlan
const none = new Set<BudgetBlock>()
const marks = (o: Partial<{ reviewed: BudgetBlock[]; skipped: BudgetBlock[]; flagEmpty: boolean }> = {}) => ({
  reviewed: new Set(o.reviewed ?? []), skipped: new Set(o.skipped ?? []), flagEmpty: o.flagEmpty ?? false,
})

describe('flaggedBlocks', () => {
  const p = plan([cat('bills', 'high'), cat('debts', 'estimated'), cat('everyday', 'estimated'), cat('everyday', 'high')])
  it('flags segments with an estimated line, in page order', () => {
    expect(flaggedBlocks(p, marks())).toEqual(['debts', 'everyday'])
  })
  it('"Looks right" clears a segment', () => {
    expect(flaggedBlocks(p, marks({ reviewed: ['debts'] }))).toEqual(['everyday'])
  })
  it('empty segments are only flagged while building by hand, unless skipped', () => {
    expect(flaggedBlocks(p, marks())).not.toContain('safety')
    expect(flaggedBlocks(p, marks({ flagEmpty: true }))).toContain('safety')
    expect(flaggedBlocks(p, marks({ flagEmpty: true, skipped: ['safety', 'goals', 'grow', 'subscriptions'] }))).toEqual(['debts', 'everyday'])
  })
})

const view = (o: { free?: number; debts?: number; month?: string | null; lines?: number }): PlanView =>
  ({
    free: o.free ?? 0, balanced: (o.free ?? 0) === 0, income: 1000,
    totals: { bills: 0, subscriptions: 0, debts: 0, everyday: 0, safety: 0, goals: 0, grow: 0 },
    blocks: { debts: { lines: Array(o.lines ?? 0).fill({}) } },
    extras: { debts: Array(o.debts ?? 0).fill({}), debtFreeMonth: o.month ?? null },
  }) as unknown as PlanView

describe('reviewSummary', () => {
  it('headline counts what is flagged, then turns to ready', () => {
    expect(reviewSummary(view({}), ['debts', 'everyday']).headline).toEqual({ kind: 'check', n: 2 })
    expect(reviewSummary(view({}), []).headline).toEqual({ kind: 'ready' })
  })
  it('over income replaces the fact line with the red headline', () => {
    expect(reviewSummary(view({ free: -450, debts: 1, month: '2027-09' }), ['debts'])).toEqual({ headline: { kind: 'over', amount: 450 }, fact: null })
  })
  it('debt-free fact: by, around when debts are flagged, unknown, omitted with no debts', () => {
    expect(reviewSummary(view({ debts: 1, month: '2027-09' }), []).fact).toEqual({ kind: 'by', month: '2027-09' })
    expect(reviewSummary(view({ debts: 1, month: '2027-09' }), ['debts']).fact).toEqual({ kind: 'around', month: '2027-09' })
    expect(reviewSummary(view({ debts: 1, month: null }), []).fact).toEqual({ kind: 'unknown' })
    expect(reviewSummary(view({}), []).fact).toBeNull()
  })
})

describe('canActivate', () => {
  it('needs nothing flagged and the plan within income', () => {
    expect(canActivate(view({}), [])).toBe(true)
    expect(canActivate(view({}), ['bills'])).toBe(false)
    expect(canActivate(view({ free: -1 }), [])).toBe(false)
  })
})

describe('walking', () => {
  it('nextFlagged moves forward through the flagged and wraps', () => {
    expect(nextFlagged(['debts', 'everyday'], null)).toBe('debts')
    expect(nextFlagged(['debts', 'everyday'], 'debts')).toBe('everyday')
    expect(nextFlagged(['debts', 'everyday'], 'everyday')).toBe('debts')
    expect(nextFlagged([], 'debts')).toBeNull()
  })
  it('nextEmpty skips segments with lines or a skip', () => {
    const p = plan([cat('bills'), cat('debts')])
    expect(nextEmpty(p, none, 'bills')).toBe('subscriptions')
    expect(nextEmpty(p, new Set<BudgetBlock>(['subscriptions']), 'bills')).toBe('everyday')
  })
})
