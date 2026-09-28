import type { SavingsType } from '@/lib/store/types'

/** Default Lucide icon name per savings type (resolved in `SavingsAccountIcon`). */
export const SAVINGS_TYPE_ICONS: Record<SavingsType, string> = {
  bank: 'Landmark',
  cash: 'Banknote',
  gold: 'Gem',
  stablecoin: 'CircleDollarSign',
  crypto: 'Bitcoin',
  stocks: 'TrendingUp',
  real_estate: 'Home',
  other: 'Wallet',
  vault: 'Vault',
}

/**
 * When `type === 'other'`, user picks one of these Lucide names.
 *
 * `PiggyBank` is deliberately absent and must never be added: the pig is not an
 * acceptable savings symbol for this product's audience. `Coins` is the canonical
 * savings glyph (it is what the bottom nav uses). See docs/DESIGN_SYSTEM.md.
 */
export const OTHER_SAVINGS_ICON_KEYS = ['Wallet', 'Coins', 'Vault', 'Star', 'Briefcase'] as const

export type OtherSavingsIconKey = (typeof OTHER_SAVINGS_ICON_KEYS)[number]
