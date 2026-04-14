import type { DebtReceivedVia } from '@/lib/store/types'

export function debtIsGoldFromReceived(rv: DebtReceivedVia): boolean {
  return rv === 'gold'
}
