import type { PaymentMethod } from '@/lib/store/types'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'

/** "CIB ••2016" is stored as one name; the list shows the provider and the digits separately. */
export function accountTitle(m: PaymentMethod): string {
  return decomposePaymentMethodName(m.name, m.last4).provider
}
