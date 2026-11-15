import type { Expense, PaymentMethod } from '@/lib/store/types'

/** The proof strip's figures, from on-device data only: how many accounts have SMS on, and how many expenses a message logged this month. */
export function smsAccountsOn(methods: readonly Pick<PaymentMethod, 'trackSms'>[]): number {
  return methods.filter((m) => m.trackSms).length
}

export function smsLoggedThisMonth(expenses: readonly Pick<Expense, 'smsLogId' | 'date'>[], now = new Date()): number {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return expenses.filter((e) => e.smsLogId && e.date.startsWith(month)).length
}
