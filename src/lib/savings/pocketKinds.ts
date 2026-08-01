import type { SavingsType } from '@/lib/store/types'

/** The "start from scratch" pocket kinds (§8). `savingsType` maps to the stored enum; the finer
 *  kind (wallet vs bank vs certificate) is carried by the icon/label + metadata (maturity, etc). */
export type PocketKind = 'bank' | 'wallet' | 'cash' | 'certificate' | 'stablecoin' | 'other'

export interface PocketKindDef {
  kind: PocketKind
  savingsType: SavingsType
  label: string
  sub: string
  color: string
  /** Lucide icon name (resolved by SavingsAccountIcon via the stored icon). */
  icon: string
  fields: Array<'provider' | 'last4' | 'maturity' | 'yearlyReturn' | 'coin'>
}

export const POCKET_KINDS: Record<PocketKind, PocketKindDef> = {
  bank: { kind: 'bank', savingsType: 'bank', label: 'Bank account', sub: 'Current or savings', color: '#7EAEF9', icon: 'Landmark', fields: ['provider', 'last4'] },
  wallet: { kind: 'wallet', savingsType: 'bank', label: 'Mobile wallet', sub: 'Vodafone Cash, InstaPay', color: '#35D46F', icon: 'Wallet', fields: ['provider', 'last4'] },
  cash: { kind: 'cash', savingsType: 'cash', label: 'Cash', sub: 'At home or in a safe', color: '#B79CFF', icon: 'Banknote', fields: [] },
  certificate: { kind: 'certificate', savingsType: 'bank', label: 'Certificate', sub: 'Fixed term, matures', color: '#2CE0C6', icon: 'Landmark', fields: ['provider', 'maturity', 'yearlyReturn'] },
  stablecoin: { kind: 'stablecoin', savingsType: 'stablecoin', label: 'Stablecoin', sub: 'USDT and friends', color: '#F5C842', icon: 'CircleDollarSign', fields: ['coin'] },
  other: { kind: 'other', savingsType: 'other', label: 'Something else', sub: 'Name it, pick an icon', color: '#9898B0', icon: 'Wallet', fields: [] },
}

export const POCKET_KIND_ORDER: PocketKind[] = ['bank', 'wallet', 'cash', 'certificate', 'stablecoin', 'other']
