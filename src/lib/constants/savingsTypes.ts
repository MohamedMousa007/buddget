import type { SavingsType } from '@/lib/store/types'

/** Order of type pills on the create-savings sheet. */
export const SAVINGS_TYPES_ORDER = [
  'bank',
  'cash',
  'gold',
  'crypto_stable',
  'crypto',
  'stocks',
  'real_estate',
  'other',
] as const satisfies readonly SavingsType[]
