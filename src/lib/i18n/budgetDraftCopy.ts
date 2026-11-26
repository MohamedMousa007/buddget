import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/** The Budget month hero for a plan that is not applied yet (light touch QA). */
export interface BudgetDraftCopy {
  label: string
  planned: string
  note: string
  apply: string
}

export const BUDGET_DRAFT_COPY: Record<Locale, BudgetDraftCopy> = {
  en: {
    label: 'Everyday budget · Not applied',
    planned: 'planned',
    note: 'This budget isn’t applied yet. Apply it to track this month against it.',
    apply: 'Apply budget',
  },
  ar: {
    label: 'ميزانية اليوميات · غير مطبّقة',
    planned: 'مخطط',
    note: 'هذه الميزانية لم تُطبَّق بعد. طبّقها لتتابع هذا الشهر عليها.',
    apply: 'طبّق الميزانية',
  },
}

export function useBudgetDraftCopy(): BudgetDraftCopy {
  return BUDGET_DRAFT_COPY[useLocale().locale]
}
