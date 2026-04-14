import type { Debt, DebtReceivedVia } from '@/lib/store/types'

/** Whether this debt is tracked in gold grams (legacy `isGold` or `receivedVia: 'gold'`). */
export function debtIsGold(d: Pick<Debt, 'isGold' | 'receivedVia'>): boolean {
  if (d.receivedVia === 'gold') return true
  if (d.receivedVia != null) return false
  return d.isGold
}

/** Default `receivedVia` for display when legacy rows omit it. */
export function debtReceivedViaOrDefault(d: Pick<Debt, 'isGold' | 'receivedVia'>): DebtReceivedVia {
  if (d.receivedVia) return d.receivedVia
  return d.isGold ? 'gold' : 'cash'
}
