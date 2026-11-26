import type { PaymentMethod } from '@/lib/store/types'
import { accountTitle } from '@/lib/accounts/accountTitle'
import { isSetUpAccount, isTracked } from '@/lib/accounts/kinds'

/**
 * The accounts money can arrive in ("Received in", "Paid into"): the rows of the Accounts page (open, set up, not a
 * card under an account), one entry per account as the user sees it. Two rows with the same name, digits, type and
 * currency read as one account; the tracked (then the oldest) one stays. Cards, BNPL, closed and provisional methods
 * never appear. `keepId` stays listed when it is one of the accounts.
 */
export function receivingAccounts(methods: readonly PaymentMethod[], keepId?: string): PaymentMethod[] {
  const accounts = methods.filter((m) => isSetUpAccount(m) && !m.parentId)
  const rank = (m: PaymentMethod) => (m.id === keepId ? 0 : isTracked(m) ? 1 : 2)
  const sorted = [...accounts].sort((a, b) => rank(a) - rank(b) || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  const seen = new Set<string>()
  const kept = new Set<string>()
  for (const m of sorted) {
    const key = [m.type, accountTitle(m).trim().toLowerCase(), m.last4 ?? '', String(m.currency)].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    kept.add(m.id)
  }
  return accounts.filter((m) => kept.has(m.id))
}
