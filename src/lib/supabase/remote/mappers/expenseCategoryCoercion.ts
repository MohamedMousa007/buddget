import type { Database } from '@/lib/supabase/database.types'
import type { ExpenseCategory } from '@/lib/store/types'
import { EXPENSE_CATEGORIES } from '@/lib/constants/finance'

type DbExpenseCategory = Database['public']['Enums']['expense_category']

/**
 * Compile-time drift guard: the `ExpenseCategory` union and the `expense_category`
 * Postgres enum must stay identical in BOTH directions. Four mappers previously kept
 * hand-copied lists that silently fell out of sync — `Installment` was coerced to
 * `Other` (a SPEND category), double-counting BNPL settlements. Any future value added
 * to one side and not the other now fails `next build` instead of corrupting rows.
 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const _expenseCategoryMatchesDbEnum: MutuallyAssignable<ExpenseCategory, DbExpenseCategory> = true
void _expenseCategoryMatchesDbEnum

/**
 * Coerces a client category to a DB enum value. `Expense.category` is typed `string`
 * because it may hold a custom budget-plan category name, but the column is an enum —
 * an unknown string raises `22P02`, so unknown values must fall back rather than throw.
 *
 * `EXPENSE_CATEGORIES` is the single source of truth (see the guard above); never
 * hand-copy this list again.
 */
export function toDbExpenseCategory<F extends DbExpenseCategory>(
  category: string,
  fallback: F,
): DbExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(category)
    ? (category as DbExpenseCategory)
    : fallback
}
