import type { Expense } from '@/lib/store/types'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { sameMerchantUncategorised } from '@/lib/spending/merchantCategory'

/** Rows to file under the same category after a manual bank-message edit: only 'Other' siblings, only for a spending category. */
export function sameMerchantTargets(
  expenses: readonly Expense[],
  edited: Pick<Expense, 'id' | 'description' | 'smsLogId'>,
  category: string,
): Expense[] {
  if (!edited.smsLogId || category === 'Other' || isNonSpendCategory(category)) return []
  return sameMerchantUncategorised(expenses, edited)
}
