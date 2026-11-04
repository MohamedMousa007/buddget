import { holdsBalance } from '@/lib/accounts/kinds'
import { resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import type { PaymentMethod } from '@/lib/store/types'

/** The one open account at the same bank a card can draw on; none when the bank has several or none. */
export function parentAccountFor(methods: readonly PaymentMethod[], provider: string | null): string | undefined {
  const brand = resolvePaymentBrandKey(provider)
  if (!brand) return undefined
  const holders = methods.filter((m) => holdsBalance(m.type) && !m.closedAt && resolvePaymentBrandKey(m.name) === brand)
  return holders.length === 1 ? holders[0].id : undefined
}
