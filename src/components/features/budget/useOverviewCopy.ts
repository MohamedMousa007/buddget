'use client'

import { useLocale } from '@/lib/i18n'
import { budgetOverviewCopyAr, budgetOverviewCopyEn, type BudgetOverviewCopy } from '@/lib/i18n/budgetPage/overviewCopy'

export function useOverviewCopy(): BudgetOverviewCopy {
  return useLocale().locale === 'ar' ? budgetOverviewCopyAr : budgetOverviewCopyEn
}
