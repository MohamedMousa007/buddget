import type { ExpenseCategory } from '@/lib/store/types'

/**
 * Categories that represent money MOVEMENT, not consumption. They are excluded
 * from spending totals, budget rollups, and spend charts. This is the single
 * source of truth for spend exclusion — never inline a `category === 'Savings'`
 * check for spend purposes; use {@link isNonSpendCategory}.
 *
 * - `Savings`: allocation to a savings account, not consumption (legacy behaviour).
 * - `ATM Cash Withdrawal`: bank balance → cash on hand; spend is recognised later.
 * - `Transfer`: between the user's own accounts; nets to zero.
 * - `Currency Exchange`: FX between the user's own currency accounts; nets to zero.
 * - `CC Payoff`: settling a credit-card debt; spend was already recognised at purchase.
 * - `Top up`: loading a prepaid card / wallet; money movement, not consumption —
 *   the actual purchases made from that card/wallet are logged separately and count.
 */
export const NON_SPEND_CATEGORIES: ReadonlySet<string> = new Set<ExpenseCategory>([
  'Savings',
  'ATM Cash Withdrawal',
  'Transfer',
  'Currency Exchange',
  'CC Payoff',
  'Top up',
])

/** True when a category is a money-movement (excluded from spend totals/budgets/charts). */
export function isNonSpendCategory(category: string | null | undefined): boolean {
  return category != null && NON_SPEND_CATEGORIES.has(category)
}

/**
 * Maps a legacy budget bucket → the newer spend categories that should roll up
 * into it for budget plans that predate those categories. Used by
 * `categorySpendingForPlanRows` so e.g. spend categorised as `Groceries` still
 * counts against a plan that only has a `Food` row. Skipped when the plan has a
 * dedicated row for the newer category.
 */
export const CATEGORY_BUDGET_ALIASES: Readonly<Record<string, readonly ExpenseCategory[]>> = {
  Food: ['Groceries'],
  Transport: ['Fuel'],
  Enjoyment: ['Shopping', 'Subscription'],
  Rent: ['Utilities'],
  Other: ['Health', 'Education'],
}
