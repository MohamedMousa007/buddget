import type { Goal, SavingsAccount } from '@/lib/store/types'
import { INVESTMENT_PRODUCT_TYPES } from '@/lib/constants/savingsTypes'

/**
 * Month-end carry: the surplus swept into savings when a budget cycle closes.
 *
 * This is the pure math. The cron orchestrates it (loads the closed month's figures, resolves
 * the destination pocket, posts the deposit, writes the summary row, sends the push) but the
 * numbers all come from here so there is one source of truth shared with the client.
 */

export interface MonthCarryInput {
  /** Actual income for the closed month, base currency. */
  income: number
  /** Non-savings spend for the closed month, base currency. */
  spend: number
  /** Savings already moved in the closed month (allocate deposits + legacy Savings expenses), base. */
  allocated: number
  /**
   * Correction carried from recomputing the IMMEDIATELY prior closed month with current data:
   * (prior month's true carry now) − (what was actually posted for it). Positive = we under-swept
   * last month (a late income appeared), negative = we over-swept (a late expense appeared).
   * Only the most-recent closed month is ever recomputed, so this never cascades. Default 0.
   */
  priorAdjustment?: number
}

export interface MonthCarryResult {
  /** max(0, income − spend − allocated) — the honest surplus for this month alone. */
  carryRaw: number
  /** The prior-month correction actually applied this cycle. */
  adjustment: number
  /** What to post into the destination pocket: carryRaw net of the prior correction, never below 0. */
  carry: number
  /** allocated + carryRaw — the month's "Saved", for the Target-vs-Saved stat. */
  saved: number
}

export function computeMonthCarry(input: MonthCarryInput): MonthCarryResult {
  const carryRaw = Math.max(0, input.income - input.spend - input.allocated)
  const adjustment = input.priorAdjustment ?? 0
  // A negative correction can zero the carry but never make it negative — we can't un-post money
  // already banked. Any residual is dropped (bounded: one month back, small, rare).
  const carry = Math.max(0, carryRaw + adjustment)
  return { carryRaw, adjustment, carry, saved: input.allocated + carryRaw }
}

const INVESTMENT = new Set<string>(INVESTMENT_PRODUCT_TYPES)

/** A pocket that may receive the carry: fiat, savings-category, never an investment/market asset. */
export function isEligibleCarryPocket(p: SavingsAccount): boolean {
  return p.category === 'savings' && !INVESTMENT.has(p.type)
}

export type CarryDestination =
  | { kind: 'pocket'; pocketId: string }
  | { kind: 'create-goal-pocket'; goalId: string; name: string }
  | { kind: 'create-vault' }

/**
 * Resolve where the carry lands: the user's default pocket → the highest-priority active savings
 * goal's linked pocket (or a new pocket named after that goal) → the auto-created "Monthly Savings"
 * vault. The vault is the floor; the goal branch is re-evaluated every cycle and never becomes the
 * stored default, so a completed goal releases the carry automatically.
 */
export function resolveCarryDestination(
  defaultPocketId: string | null | undefined,
  pockets: SavingsAccount[],
  activeGoals: Goal[],
): CarryDestination {
  const eligible = pockets.filter(isEligibleCarryPocket)

  if (defaultPocketId) {
    const d = eligible.find((p) => p.id === defaultPocketId)
    if (d) return { kind: 'pocket', pocketId: d.id }
  }

  // Highest priority, then soonest target date, then oldest.
  const savingsGoals = activeGoals
    .filter((g) => g.status === 'active' && g.category !== 'debt_freedom' && g.category !== 'spending_control')
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      if (a.targetDate && b.targetDate && a.targetDate !== b.targetDate) return a.targetDate < b.targetDate ? -1 : 1
      return a.createdAt < b.createdAt ? -1 : 1
    })

  for (const g of savingsGoals) {
    const linked = g.linkedSavingsAccountIds
      .map((id) => eligible.find((p) => p.id === id))
      .find((p): p is SavingsAccount => !!p)
    if (linked) return { kind: 'pocket', pocketId: linked.id }
    // Winning goal with no eligible pocket → make one named after the goal and link it.
    return { kind: 'create-goal-pocket', goalId: g.id, name: g.name }
  }

  const existingVault = eligible.find((p) => p.type === 'vault')
  if (existingVault) return { kind: 'pocket', pocketId: existingVault.id }
  return { kind: 'create-vault' }
}
