import type { PaymentMethod } from '@/lib/store/types'
import { isTracked } from '@/lib/accounts/kinds'
import { resolveAccountId } from '@/lib/accounts/resolve'

/**
 * The account a pocket created "from an account you already have" is an earmark inside: the tracked account that
 * method spends from (a debit card resolves to its parent), in the pocket's currency. Undefined = the pocket stands alone.
 */
export function pocketHolderId(method: PaymentMethod, methods: readonly PaymentMethod[], pocketCurrency: string): string | undefined {
  const holder = methods.find((m) => m.id === resolveAccountId(method.id, methods))
  return holder && isTracked(holder) && !holder.closedAt && String(holder.currency) === pocketCurrency ? holder.id : undefined
}
