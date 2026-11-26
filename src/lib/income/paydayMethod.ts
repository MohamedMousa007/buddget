import { accountTitle } from '@/lib/accounts/accountTitle'
import type { IncomeSource, PaymentMethod } from '@/lib/store/types'

/** The account a payday lands in, as stored: '' when none is set or the stored one is gone. The list and the edit sheet both read this. */
export function paydayMethodId(source: Pick<IncomeSource, 'paymentMethodId'>, methods: Pick<PaymentMethod, 'id'>[]): string {
  const id = source.paymentMethodId ?? ''
  return id && methods.some((m) => m.id === id) ? id : ''
}

/** "Received in" as the edit sheet's row shows it: the account's title, then ••last4. Null when not set. */
export function paydayMethodLabel(source: Pick<IncomeSource, 'paymentMethodId'>, methods: PaymentMethod[]): string | null {
  const pm = methods.find((m) => m.id === paydayMethodId(source, methods))
  if (!pm) return null
  return pm.last4 ? `${accountTitle(pm)} ••${pm.last4}` : accountTitle(pm)
}
