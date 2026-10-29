import type { Dictionary } from '@/lib/i18n/types'

/** Display name of a stored category ("Food" → "طعام" in Arabic). The stored value never changes; unknown categories show as typed. */
export function categoryLabel(t: Pick<Dictionary, 'expenseForm'>, category: string): string {
  return t.expenseForm.categoryLabels[category] ?? category
}
