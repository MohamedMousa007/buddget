import type { Dictionary } from '@/lib/i18n/types'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'

/** Display name of a stored category ("Food" → "طعام" in Arabic). The stored value never changes; unknown categories show as typed. */
export function categoryLabel(t: Pick<Dictionary, 'expenseForm'>, category: string): string {
  return t.expenseForm.categoryLabels[category] ?? category
}

/** `categoryLabel` for code that only knows the locale (Buddgy tool previews). */
export function categoryLabelFor(locale: 'en' | 'ar', category: string): string {
  return categoryLabel(getServerDictionary(locale), category)
}
