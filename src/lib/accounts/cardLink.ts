import type { PaymentMethod, PaymentMethodType } from '@/lib/store/types'
import { decomposePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { canBeParent } from './kinds'

/** Cards that hang under an account: debit draws on it, credit only groups there. Prepaid, wallets and service cards stay standalone. */
export const linksToAccount = (type: PaymentMethodType): boolean => type === 'debit_card' || type === 'credit_card'

/** The parent a card saves with: none for a type that never links. */
export const savedParentId = (type: PaymentMethodType, linkedId: string | undefined): string | undefined =>
  linksToAccount(type) ? linkedId : undefined

/** Accounts a card may hang under: open, confirmed banks and wallets. */
export function linkableAccounts(methods: readonly PaymentMethod[]): PaymentMethod[] {
  return methods.filter((m) => canBeParent(m.type) && !m.parentId && !m.closedAt && !m.provisional)
}

const providerKey = (text: string): string => resolvePaymentBrandKey(text) ?? text.trim().toLowerCase()

/** The one account of this provider (in the card's currency when the provider has several); otherwise none. */
export function matchLinkedAccount(provider: string, currency: string, accounts: readonly PaymentMethod[]): string | undefined {
  if (!provider.trim()) return undefined
  const key = providerKey(provider)
  const same = accounts.filter((a) => providerKey(decomposePaymentMethodName(a.name, a.last4).provider) === key)
  const pick = same.length === 1 ? same : same.filter((a) => String(a.currency) === currency)
  return pick.length === 1 ? pick[0].id : undefined
}

/** Moving a used debit card to another account moves its past spending with it, so the user confirms. */
export function relinkNeedsConfirm(card: PaymentMethod | null, nextParentId: string | undefined, hasHistory: boolean): boolean {
  return !!card && card.type === 'debit_card' && hasHistory && (card.parentId ?? undefined) !== nextParentId
}
