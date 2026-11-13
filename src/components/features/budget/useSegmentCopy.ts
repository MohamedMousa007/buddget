'use client'

import { useLocale } from '@/lib/i18n'
import { budgetSegmentCopyAr, budgetSegmentCopyEn, type BudgetSegmentCopy } from '@/lib/i18n/budgetPage/segmentCopy'

export function useSegmentCopy(): BudgetSegmentCopy {
  return useLocale().locale === 'ar' ? budgetSegmentCopyAr : budgetSegmentCopyEn
}
