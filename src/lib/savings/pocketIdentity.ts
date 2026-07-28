import type { SavingsAccount, SavingsType } from '@/lib/store/types'

/** Colour token per pocket type (v3 accents), overridable by the pocket's own `color`. */
const TYPE_COLOR: Partial<Record<SavingsType, string>> = {
  bank: '#7EAEF9',
  cash: '#B79CFF',
  gold: '#F5C842',
  stablecoin: '#B79CFF',
  vault: '#35D46F',
}

export function pocketColor(a: Pick<SavingsAccount, 'type' | 'color'>): string {
  return a.color ?? TYPE_COLOR[a.type] ?? '#7EAEF9'
}

const TYPE_LABEL: Partial<Record<SavingsType, string>> = {
  bank: 'Bank account',
  cash: 'Cash',
  gold: 'Gold',
  stablecoin: 'Stablecoin',
  vault: 'Monthly Savings',
}

/**
 * The card sub-line — the account identity, not the balance:
 *   "CIB · Bank account ••••2016" · "Safe" · "NBE · matures Nov 2027".
 */
export function pocketIdentity(a: SavingsAccount): string {
  const parts: string[] = []
  if (a.institution) parts.push(a.institution)
  const typeLabel = TYPE_LABEL[a.type]
  if (a.maturityDate) {
    const d = new Date(a.maturityDate)
    const m = d.toLocaleString('en-US', { month: 'short' })
    parts.push(`matures ${m} ${d.getFullYear()}`)
  } else if (typeLabel && a.type !== 'cash') {
    parts.push(a.accountLast4 ? `${typeLabel} ••••${a.accountLast4}` : typeLabel)
  }
  return parts.join(' · ') || a.name
}
