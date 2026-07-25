import { describe, it, expect } from 'vitest'
import type { Goal, SavingsAccount } from '@/lib/store/types'
import { computeMonthCarry, resolveCarryDestination, isEligibleCarryPocket } from './monthCarry'

describe('computeMonthCarry', () => {
  it('banks the whole surplus', () => {
    const r = computeMonthCarry({ income: 10_000, spend: 6_000, allocated: 2_000 })
    expect(r.carryRaw).toBe(2_000)
    expect(r.carry).toBe(2_000)
    expect(r.saved).toBe(4_000) // allocated + carryRaw
  })

  it('never negative when the month overspent', () => {
    const r = computeMonthCarry({ income: 5_000, spend: 6_000, allocated: 0 })
    expect(r.carry).toBe(0)
    expect(r.saved).toBe(0)
  })

  it('applies a positive prior-month correction (late income last month)', () => {
    // last month under-swept by 300 → add it to this month
    const r = computeMonthCarry({ income: 10_000, spend: 8_000, allocated: 0, priorAdjustment: 300 })
    expect(r.carryRaw).toBe(2_000)
    expect(r.carry).toBe(2_300)
  })

  it('applies a negative correction, clamped at zero (never un-posts)', () => {
    const r = computeMonthCarry({ income: 1_000, spend: 900, allocated: 0, priorAdjustment: -500 })
    expect(r.carryRaw).toBe(100)
    expect(r.carry).toBe(0) // 100 − 500 clamped
  })
})

const pocket = (over: Partial<SavingsAccount>): SavingsAccount => ({
  id: 'p', name: 'p', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 0,
  createdAt: '2026-01-01', ...over,
})
const goal = (over: Partial<Goal>): Goal => ({
  id: 'g', name: 'Goal', emoji: '🎯', category: 'custom', targetAmount: 1000, currency: 'EGP',
  manualCurrentAmount: 0, targetDate: null, linkedSavingsAccountIds: [], linkedDebtIds: [],
  monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: null,
  notes: null, createdAt: '2026-01-01', achievedAt: null, ...over,
})

describe('resolveCarryDestination', () => {
  it('uses the default pocket when it is eligible', () => {
    const d = resolveCarryDestination('p1', [pocket({ id: 'p1' })], [])
    expect(d).toEqual({ kind: 'pocket', pocketId: 'p1' })
  })

  it('rejects a gold/crypto default and falls through', () => {
    // an investment pocket is not eligible; no goal → vault
    const d = resolveCarryDestination('g1', [pocket({ id: 'g1', category: 'investment', type: 'gold', currency: 'XAU' })], [])
    expect(d).toEqual({ kind: 'create-vault' })
  })

  it('routes to the highest-priority active goal’s linked pocket', () => {
    const pockets = [pocket({ id: 'lo' }), pocket({ id: 'hi' })]
    const goals = [
      goal({ id: 'g1', priority: 1, linkedSavingsAccountIds: ['lo'] }),
      goal({ id: 'g2', priority: 5, linkedSavingsAccountIds: ['hi'] }),
    ]
    expect(resolveCarryDestination(null, pockets, goals)).toEqual({ kind: 'pocket', pocketId: 'hi' })
  })

  it('creates a goal-named pocket when the winning goal has none', () => {
    const d = resolveCarryDestination(null, [], [goal({ id: 'g2', name: 'Car', priority: 5 })])
    expect(d).toEqual({ kind: 'create-goal-pocket', goalId: 'g2', name: 'Car' })
  })

  it('falls back to an existing vault, else creates one', () => {
    expect(resolveCarryDestination(null, [pocket({ id: 'v', type: 'vault' })], [])).toEqual({ kind: 'pocket', pocketId: 'v' })
    expect(resolveCarryDestination(null, [], [])).toEqual({ kind: 'create-vault' })
  })

  it('isEligibleCarryPocket excludes investment and market pockets', () => {
    expect(isEligibleCarryPocket(pocket({ type: 'bank' }))).toBe(true)
    expect(isEligibleCarryPocket(pocket({ type: 'vault' }))).toBe(true)
    expect(isEligibleCarryPocket(pocket({ category: 'investment', type: 'crypto' }))).toBe(false)
  })
})
