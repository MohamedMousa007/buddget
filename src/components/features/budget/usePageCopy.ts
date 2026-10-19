'use client'

import { useLocale } from '@/lib/i18n'
import { budgetPageCopyAr, budgetPageCopyEn, type BudgetPageCopy } from '@/lib/i18n/budgetPage/pageCopy'

export function useBudgetPageCopy(): BudgetPageCopy {
  return useLocale().locale === 'ar' ? budgetPageCopyAr : budgetPageCopyEn
}
