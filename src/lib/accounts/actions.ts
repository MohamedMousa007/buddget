import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod } from '@/lib/store/types'
import { localTodayISO } from '@/lib/utils/localDate'
import { DEFAULT_CASH_ID, isTracked } from './kinds'
import { removePaymentMethod } from './removePaymentMethod'
import { cashAccountId } from './resolve'

const store = () => useFinanceStore.getState()

/** Gives an account its starting balance; everything dated before this instant is ignored by the engine. */
export function setOpeningBalance(accountId: string, balance: number, at: Date = new Date()): void {
  store().updatePaymentMethod(accountId, { openingBalance: balance, openingAt: at.toISOString() })
}

/**
 * The Cash account as a real, syncable row. The in-store cash sentinel cannot carry a balance
 * (its id is not a uuid), so the first time Cash is tracked a real "Cash" method is created.
 */
export function ensureCashAccount(): string {
  const { paymentMethods, settings, addPaymentMethod } = store()
  const existing = cashAccountId(paymentMethods)
  if (existing && existing !== DEFAULT_CASH_ID) return existing
  return addPaymentMethod({ name: 'Cash', type: 'cash', currency: settings.baseCurrency, isDefault: false, color: '#C9C9D4' })
}

/** Cash out: money leaves the account and becomes Cash. One non-spend row, two balance deltas. */
export function cashOut(fromId: string, amount: number, currency: PaymentMethod['currency'], at: Date = new Date()): void {
  store().addExpense({
    occurredAt: at.toISOString(),
    description: 'Cash out',
    category: 'ATM Cash Withdrawal',
    amount,
    currency,
    date: localTodayISO(at),
    paymentMethodId: fromId,
    toPaymentMethodId: ensureCashAccount(),
    isRecurring: false,
  })
}

/** Set aside: a pocket deposit stamped with the account it came from (earmark when the pocket is held in it). */
export function setAside(fromId: string, pocketId: string, amount: number, currency: PaymentMethod['currency']): void {
  store().depositToSavings(pocketId, amount, currency, undefined, { mode: 'declare', paymentMethodId: fromId })
}

/** "What does your bank show now?": records the difference as an explicit adjustment, never as an expense. */
export function updateBalance(accountId: string, current: number, reported: number, reason: 'manual_update' | 'gap' = 'manual_update'): number {
  const account = store().paymentMethods.find((m) => m.id === accountId)
  if (accountId === DEFAULT_CASH_ID || (account && !isTracked(account))) {
    setOpeningBalance(accountId === DEFAULT_CASH_ID ? ensureCashAccount() : accountId, reported)
    return Math.round((reported - current) * 100) / 100
  }
  const delta = Math.round((reported - current) * 100) / 100
  if (delta === 0) return 0
  store().addAccountAdjustment({ paymentMethodId: accountId, delta, reason, occurredAt: new Date().toISOString() })
  return delta
}

/** Closed accounts keep their history; their cards become standalone cards. */
export function closeAccount(accountId: string): void {
  useFinanceStore.setState((s) => {
    const removal = removePaymentMethod(s, accountId, 'close')
    return removal ? { paymentMethods: removal.paymentMethods } : {}
  })
}
