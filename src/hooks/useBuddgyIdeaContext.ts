'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { formatCurrency } from '@/lib/utils/formatters'
import { screenFromPath, type BuddgyIdeaContext } from '@/lib/ai/buddgyIdeas'

/** What Buddgy knows about where the user is and how their month looks. */
export function useBuddgyIdeaContext(): BuddgyIdeaContext {
  const pathname = usePathname()
  const stats = useMonthlyStats()
  const hasDebts = useFinanceStore((s) => s.debts.length > 0)
  const hasGoals = useFinanceStore((s) => s.goals.length > 0)
  const catLabel = useCategoryLabel()

  return useMemo(
    () => ({
      screen: screenFromPath(pathname),
      paceStatus: stats.paceStatus,
      overBudgetCategories: stats.overBudgetCategories.map((c) => ({ ...c, category: catLabel(c.category) })),
      hasBudget: stats.totalExpenseBudget > 0,
      hasDebts,
      hasGoals,
      hasSpending: stats.totalSpentExcludingSavings > 0,
      dailyAllowance:
        stats.suggestedDaily > 0 ? formatCurrency(Math.round(stats.suggestedDaily), stats.baseCurrency, false) : null,
    }),
    [pathname, stats, hasDebts, hasGoals, catLabel],
  )
}
