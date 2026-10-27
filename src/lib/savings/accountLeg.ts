import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { isTracked } from '@/lib/accounts/kinds'
import { pickPrimaryAccountId } from '@/lib/accounts/primary'

const isPrimaryCandidate = (pm: PaymentMethod) =>
  (pm.type === 'bank_account' || pm.type === 'wallet') && isTracked(pm) && !pm.closedAt

export function primaryTrackedAccount(methods: readonly PaymentMethod[]): string | null {
  return pickPrimaryAccountId(methods.filter(isPrimaryCandidate))
}

/** Whether `accountId` may carry a ledger leg for this pocket move. Same currency only (the leg is not FX-frozen). */
export function canCarryLeg(
  methods: readonly PaymentMethod[],
  pocket: Pick<SavingsAccount, 'heldInPaymentMethodId'>,
  accountId: string,
  legCurrency: string,
): boolean {
  const pm = methods.find((m) => m.id === accountId)
  return !!pm && isTracked(pm) && !pm.closedAt && String(pm.currency) === legCurrency
    && pocket.heldInPaymentMethodId !== accountId
}

/**
 * Account that funds (deposit) or receives (income withdrawal) a pocket move.
 * `requested`: undefined = the primary tracked account, null = deliberately none, string = that account.
 * Returns undefined when no valid leg exists (no tracked account, currency mismatch, pocket held in it).
 */
export function resolveAccountLeg(
  methods: readonly PaymentMethod[],
  pocket: Pick<SavingsAccount, 'heldInPaymentMethodId'>,
  requested: string | null | undefined,
  legCurrency: string,
): string | undefined {
  if (requested === null) return undefined
  const id = requested ?? primaryTrackedAccount(methods)
  return id && canCarryLeg(methods, pocket, id, legCurrency) ? id : undefined
}

/** Stable id for the income event a withdrawal posts, so deleting the withdrawal finds exactly its own event. */
export function incomeEventIdForTx(txId: string): string {
  const flipped = ((parseInt(txId[0], 16) ^ 8) & 15).toString(16)
  return flipped + txId.slice(1)
}

/** Deterministic uuid-shaped id from a key (idempotent across devices); not cryptographic. */
export function deterministicId(key: string): string {
  const parts: number[] = []
  for (let seed = 0; seed < 4; seed++) {
    let h = (0x811c9dc5 ^ (seed * 0x9e3779b1)) >>> 0
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0
    parts.push(h)
  }
  const hex = parts.map((p) => p.toString(16).padStart(8, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
