'use client'

import { useLocale } from '@/lib/i18n'
import { budgetDeckCopyAr, budgetDeckCopyEn, type BudgetDeckCopy } from '@/lib/i18n/budgetPage/deckCopy'

export function useBudgetDeckCopy(): BudgetDeckCopy {
  return useLocale().locale === 'ar' ? budgetDeckCopyAr : budgetDeckCopyEn
}
