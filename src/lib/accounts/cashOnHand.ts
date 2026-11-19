import type { PaymentMethod } from '@/lib/store/types'
import { isTracked } from './kinds'
import { cashAccountId, resolveAccountId } from './resolve'

/** Remembered in the dismissed-prompts list: the question is asked once, answered or skipped. */
export const CASH_ASK_KEY = 'cash-on-hand-ask'

/** After an expense paid with Cash: ask once how much cash the user holds, unless Cash already has a balance. */
export function shouldAskCashOnHand(methods: readonly PaymentMethod[], paidWithId: string | undefined, dismissed: readonly string[]): boolean {
  if (dismissed.includes(CASH_ASK_KEY)) return false
  const cashId = cashAccountId(methods)
  if (!cashId || resolveAccountId(paidWithId, methods) !== cashId) return false
  const cash = methods.find((m) => m.id === cashId)
  return !!cash && !isTracked(cash)
}
