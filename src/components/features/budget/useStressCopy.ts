'use client'

import { useLocale } from '@/lib/i18n'
import { budgetStressCopyAr, budgetStressCopyEn, type BudgetStressCopy } from '@/lib/i18n/budgetPage/stressCopy'

export function useBudgetStressCopy(): BudgetStressCopy {
  return useLocale().locale === 'ar' ? budgetStressCopyAr : budgetStressCopyEn
}
