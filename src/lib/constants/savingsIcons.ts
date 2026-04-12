import type { SavingsType } from '@/lib/store/types'

/** Default Lucide icon name per savings type (resolved in `SavingsAccountIcon`). */
export const SAVINGS_TYPE_ICONS: Record<SavingsType, string> = {
  bank: 'Landmark',
  cash: 'Banknote',
  gold: 'Gem',
  crypto_stable: 'CircleDollarSign',
  crypto: 'Bitcoin',
  stocks: 'TrendingUp',
  real_estate: 'Home',
  other: 'Wallet',
}

/** When `type === 'other'`, user picks one of these Lucide names. */
export const OTHER_SAVINGS_ICON_KEYS = ['Wallet', 'PiggyBank', 'Vault', 'Star', 'Briefcase'] as const

export type OtherSavingsIconKey = (typeof OTHER_SAVINGS_ICON_KEYS)[number]
