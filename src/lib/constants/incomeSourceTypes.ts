import type { IncomeSourceType } from '@/lib/store/types'

/** Types the user can pick when adding income manually (auto types are excluded). */
export const MANUAL_INCOME_SOURCE_TYPES: IncomeSourceType[] = [
  'salary',
  'bonus',
  'side_hustle',
  'debt',
  'gift',
  'refund',
  'other',
]

/** All known income source types (including system-generated savings / investment). */
export const ALL_INCOME_SOURCE_TYPES: IncomeSourceType[] = [
  'salary',
  'bonus',
  'side_hustle',
  'investment',
  'savings',
  'debt',
  'gift',
  'refund',
  'other',
]
