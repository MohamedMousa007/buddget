'use client'

import { useLocale } from '@/lib/i18n'
import { budgetStudioCopyAr, budgetStudioCopyEn, type BudgetStudioCopy } from '@/lib/i18n/budgetPage/studioCopy'

export function useBudgetStudioCopy(): BudgetStudioCopy {
  return useLocale().locale === 'ar' ? budgetStudioCopyAr : budgetStudioCopyEn
}
