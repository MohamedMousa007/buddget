import type { AccountAdjustment } from '@/lib/store/types'
import { computeBalances, minorUnit, type LedgerInput } from './balance'

/**
 * Deleting a pocket held in a tracked account drops its transactions, and with them the account legs the
 * balance derived from them (money spent from the pocket would come back). One signed adjustment per tracked
 * account whose balance changed by the delete freezes those balances as they were.
 */
export function pocketCloseAdjustments(
  before: LedgerInput, after: LedgerInput, pocketName: string, nowIso: string, newId: () => string,
): AccountAdjustment[] {
  const was = computeBalances(before)
  const now = computeBalances(after)
  const out: AccountAdjustment[] = []
  for (const [id, b] of was) {
    const a = now.get(id)
    if (!a) continue
    const minor = Math.round((b.balance - a.balance) * minorUnit(b.currency))
    if (minor === 0) continue
    out.push({
      id: newId(), paymentMethodId: id, delta: minor / minorUnit(b.currency), reason: 'manual_update',
      occurredAt: nowIso, note: `Pocket closed: ${pocketName}`, createdAt: nowIso, updatedAt: nowIso,
    })
  }
  return out
}
