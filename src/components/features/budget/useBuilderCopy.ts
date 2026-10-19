'use client'

import { useLocale } from '@/lib/i18n'
import { budgetBuilderCopyAr, budgetBuilderCopyEn, type BudgetBuilderCopy } from '@/lib/i18n/budgetPage/builderCopy'

export function useBudgetBuilderCopy(): BudgetBuilderCopy {
  return useLocale().locale === 'ar' ? budgetBuilderCopyAr : budgetBuilderCopyEn
}
