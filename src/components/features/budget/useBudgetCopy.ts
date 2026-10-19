import { useLocale } from '@/lib/i18n'
import { budgetChromeCopyAr, budgetChromeCopyEn, type BudgetChromeCopy } from '@/lib/i18n/budgetPage/chromeCopy'

export function useBudgetChromeCopy(): BudgetChromeCopy {
  return useLocale().locale === 'ar' ? budgetChromeCopyAr : budgetChromeCopyEn
}
