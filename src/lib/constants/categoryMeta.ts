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
 * - `Installment`: settling a BNPL installment; the purchase was already counted as
 *   spend at checkout, so each installment payment is a settlement, not new spend.
 */
export const NON_SPEND_CATEGORIES: ReadonlySet<string> = new Set<ExpenseCategory>([
  'Savings',
  'ATM Cash Withdrawal',
  'Transfer',
  'Currency Exchange',
  'CC Payoff',
  'Top up',
  'Installment',
])

/**
 * Money that only moves between the user's own places (ATM cash-out, own-account transfer, top-up, currency exchange).
 * Flow does not list these. Card payoffs and instalments stay listed: they are payments made.
 */
export const INTERNAL_MOVE_CATEGORIES: ReadonlySet<string> = new Set<ExpenseCategory>(['ATM Cash Withdrawal', 'Transfer', 'Currency Exchange', 'Top up'])

export const isInternalMoveCategory = (category: string | null | undefined): boolean => category != null && INTERNAL_MOVE_CATEGORIES.has(category)

/** Categories a transfer to another person is booked under (bank messages and manual rows). A purchase is never one. */
export const PERSON_TRANSFER_CATEGORIES: ReadonlySet<string> = new Set<ExpenseCategory>(['Instapay', 'Remittance'])

/** True when a category is a money-movement (excluded from spend totals/budgets/charts). */
export function isNonSpendCategory(category: string | null | undefined): boolean {
  return category != null && NON_SPEND_CATEGORIES.has(category)
}

/**
 * True when an expense must stay out of spending totals, budgets and charts: a money-movement category, or one the
 * user (or its payment method) left out. Excluded expenses are still logged and still move the account balance.
 * Use this for spend purposes wherever an expense row is at hand.
 */
export function isNonSpendExpense(e: { category: string | null | undefined; spendExclusion?: string | null }): boolean {
  return isNonSpendCategory(e.category) || Boolean(e.spendExclusion)
}

/** A row that counts as spending: not a money movement or excluded row, and not refunded or declined (their net effect is zero). */
export const isReportSpendRow = (e: { category: string | null | undefined; spendExclusion?: string | null; refundKind?: string | null }): boolean =>
  !isNonSpendExpense(e) && !e.refundKind

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
