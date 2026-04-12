import type { SavingsAccountCategory, SavingsType } from '@/lib/store/types'

/** Safe / liquid product types (create flow — Savings tab). */
export const SAVINGS_PRODUCT_TYPES = ['bank', 'cash', 'gold', 'stablecoin'] as const satisfies readonly SavingsType[]

/** Growth / volatile types (create flow — Investment tab). */
export const INVESTMENT_PRODUCT_TYPES = ['crypto', 'stocks', 'real_estate', 'other'] as const satisfies readonly SavingsType[]

/** @deprecated Use {@link SAVINGS_PRODUCT_TYPES} / {@link INVESTMENT_PRODUCT_TYPES}. */
export const SAVINGS_TYPES_ORDER = [
  'bank',
  'cash',
  'gold',
  'stablecoin',
  'crypto',
  'stocks',
  'real_estate',
  'other',
] as const satisfies readonly SavingsType[]

export function defaultCategoryForSavingsType(type: SavingsType): SavingsAccountCategory {
  return (INVESTMENT_PRODUCT_TYPES as readonly SavingsType[]).includes(type) ? 'investment' : 'savings'
}
