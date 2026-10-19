'use client'

import { useLocale } from '@/lib/i18n'
import { budgetBlocksCopyAr, budgetBlocksCopyEn, type BudgetBlocksCopy } from '@/lib/i18n/budgetPage/blocksCopy'

export function useBudgetBlocksCopy(): BudgetBlocksCopy {
  return useLocale().locale === 'ar' ? budgetBlocksCopyAr : budgetBlocksCopyEn
}
