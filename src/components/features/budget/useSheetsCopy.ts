'use client'

import { useLocale } from '@/lib/i18n'
import {
  budgetSheetsCopyAr,
  budgetSheetsCopyEn,
  type BudgetSheetsCopy,
} from '@/lib/i18n/budgetPage/sheetsCopy'

export function useBudgetSheetsCopy(): BudgetSheetsCopy {
  return useLocale().locale === 'ar' ? budgetSheetsCopyAr : budgetSheetsCopyEn
}
