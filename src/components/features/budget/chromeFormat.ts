import { BLOCK_META } from '@/lib/budget/blocks'
import type { BudgetBlock } from '@/lib/store/types'
import { intlTag, type AppLocale } from '@/lib/i18n/dateFormat'

/** Colour for a block: its `--color-cat-N`, neutral for cat 0. */
export function blockColor(block: BudgetBlock): string {
  const { cat } = BLOCK_META[block]
  return cat === 0 ? 'var(--color-brand-text-muted)' : `var(--color-cat-${cat})`
}

/** Where a linked block's lines are managed. */
export const LINKED_ROUTE: Partial<Record<BudgetBlock, string>> = {
  subscriptions: '/subscriptions',
  debts: '/debts',
  goals: '/goals',
  safety: '/wealth',
}

/** One decimal at most, no trailing zero. */
export function percentText(p: number): string {
  return `${Math.round(p * 10) / 10}%`
}

/** `YYYY-MM` as "Sep 2027" in the user's language. */
export function monthKeyLabel(key: string, locale: AppLocale): string {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' })
}
