'use client'

import { useLocale } from '@/lib/i18n'
import { budgetCloseCopyAr, budgetCloseCopyEn, type BudgetCloseCopy } from '@/lib/i18n/budgetPage/closeCopy'

export function useBudgetCloseCopy(): BudgetCloseCopy {
  return useLocale().locale === 'ar' ? budgetCloseCopyAr : budgetCloseCopyEn
}
