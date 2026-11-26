import type { Debt, PaymentMethod } from '@/lib/store/types'
import { defaultMethodId } from '@/lib/accounts/resolve'

/**
 * The method a payment toward `debt` starts on: the plan's own default card while it is still open, else the app-wide
 * default. A deleted or closed default (the server nulls a deleted one; the local store may still hold the id) falls back.
 */
export function debtPayMethodId(debt: Pick<Debt, 'defaultPaymentMethodId'> | undefined, methods: readonly PaymentMethod[]): string {
  const own = debt?.defaultPaymentMethodId
  if (own && methods.some((m) => m.id === own && !m.closedAt)) return own
  return defaultMethodId(methods)
}
