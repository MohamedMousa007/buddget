'use client'

import { useT } from '@/lib/i18n'
import { formatCustomRange, type ExpenseRange, type ResolvedRange } from './dateRange'

/**
 * Human label for the active range — shared by the Expenses header and the range chip
 * so the two can never disagree. Preset labels reuse `common.today`/`common.yesterday`
 * rather than minting duplicates.
 */
export function useRangeLabel(range: ExpenseRange, resolved: ResolvedRange): string {
  const t = useT()
  switch (range.preset) {
    case 'today':
      return t.common.today
    case 'yesterday':
      return t.common.yesterday
    case 'week':
      return t.expenses.periodThisWeek
    case 'custom':
      return formatCustomRange(resolved)
    case 'month':
      return t.expenses.periodThisMonth
  }
}
