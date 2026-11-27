import type { Currency, PaymentMethod } from '@/lib/store/types'
import { canHoldParts } from '@/lib/accounts/kinds'
import { resolveAccountId } from '@/lib/accounts/resolve'

/**
 * The account a pocket created "from an account you already have" is an earmark inside: the account (able to hold parts) that
 * method spends from (a debit card resolves to its parent), in the pocket's currency. Undefined = the pocket stands alone.
 */
export function pocketHolderId(method: PaymentMethod, methods: readonly PaymentMethod[], pocketCurrency: string): string | undefined {
  const holder = methods.find((m) => m.id === resolveAccountId(method.id, methods))
  return canHoldParts(holder) && String(holder.currency) === pocketCurrency ? holder.id : undefined
}

/**
 * The currency of a pocket created from this method: that of the account the money sits in (a debit card's parent).
 * The form locks it, because another currency would drop the holder and count the same money a second time.
 */
export function linkedPocketCurrency(method: PaymentMethod, methods: readonly PaymentMethod[]): Currency {
  return (methods.find((m) => m.id === resolveAccountId(method.id, methods)) ?? method).currency
}
