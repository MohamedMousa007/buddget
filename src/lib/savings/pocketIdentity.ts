import type { SavingsAccount, SavingsType } from '@/lib/store/types'
import type { SavingsFormsCopy } from '@/lib/i18n/savingsFormsCopy'
import { monthNames, type AppLocale } from '@/lib/i18n/dateFormat'
import { parseDateOnly } from '@/lib/time/calendarDays'

/** Colour token per pocket type (v3 accents), overridable by the pocket's own `color`. */
const TYPE_COLOR: Partial<Record<SavingsType, string>> = {
  bank: '#7EAEF9',
  cash: '#B79CFF',
  gold: '#EDC463',
  stablecoin: '#B79CFF',
  vault: '#35D46F',
}

export function pocketColor(a: Pick<SavingsAccount, 'type' | 'color'>): string {
  return a.color ?? TYPE_COLOR[a.type] ?? '#7EAEF9'
}

/** The stored name of the vault the app creates for every user; shown translated, never rewritten. */
export const SYSTEM_VAULT_NAME = 'Monthly Savings'

export function pocketDisplayName(a: Pick<SavingsAccount, 'type' | 'name'>, systemNames: SavingsFormsCopy['systemNames']): string {
  return a.type === 'vault' && a.name === SYSTEM_VAULT_NAME ? systemNames.monthlySavings : a.name
}

/**
 * The card sub-line — the account identity, not the balance:
 *   "CIB · Bank account ••••2016" · "Safe" · "NBE · matures Nov 2027".
 */
export function pocketIdentity(a: SavingsAccount, identity: SavingsFormsCopy['identity'], locale: AppLocale = 'en'): string {
  const parts: string[] = []
  if (a.institution) parts.push(a.institution)
  const typeLabel = (identity.types as Partial<Record<SavingsType, string>>)[a.type]
  if (a.maturityDate) {
    const d = parseDateOnly(a.maturityDate)
    parts.push(identity.matures(monthNames(locale, 'short')[d.getMonth()], d.getFullYear()))
  } else if (typeLabel && a.type !== 'cash') {
    parts.push(a.accountLast4 ? `${typeLabel} ••••${a.accountLast4}` : typeLabel)
  }
  return parts.join(' · ') || a.name
}
