import type { Debt, DebtReceivedVia } from '@/lib/store/types'

/** Keep `isGold` and `receivedVia` aligned on write. */
export function normalizeDebtIncoming(debt: Omit<Debt, 'id' | 'createdAt'>): Omit<Debt, 'id' | 'createdAt'> {
  const isGold = debt.receivedVia === 'gold' || (debt.receivedVia == null && debt.isGold)
  const receivedVia: DebtReceivedVia = debt.receivedVia ?? (isGold ? 'gold' : 'cash')
  return { ...debt, isGold, receivedVia }
}
