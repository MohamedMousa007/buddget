import type { PaymentMethod } from '@/lib/store/types'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'

/** "CIB ••2016" is stored as one name; the list shows the provider and the digits separately. */
export function accountTitle(m: PaymentMethod): string {
  return decomposePaymentMethodName(m.name, m.last4).provider
}

/** What the user calls the account: their Name (the `label`) when set, else the provider ("QA CIB" over "CIB"). */
export function accountDisplayName(m: Pick<PaymentMethod, 'name' | 'last4' | 'label'>): string {
  return m.label?.trim() || decomposePaymentMethodName(m.name, m.last4).provider
}
