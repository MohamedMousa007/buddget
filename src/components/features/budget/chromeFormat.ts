import { BLOCK_META } from '@/lib/budget/blocks'
import type { BudgetBlock } from '@/lib/store/types'

/** Colour for a block: its `--color-cat-N`, neutral for cat 0. */
export function blockColor(block: BudgetBlock): string {
  const { cat } = BLOCK_META[block]
  return cat === 0 ? 'var(--color-brand-text-muted)' : `var(--color-cat-${cat})`
}

/** One decimal at most, no trailing zero. */
export function percentText(p: number): string {
  return `${Math.round(p * 10) / 10}%`
}
