import type { PaymentMethodType } from '@/lib/store/types'
import { minorUnit } from './balance'

/** What saving a typed balance writes: nothing, a correction against the ledger, or the balance tracking starts from. */
export type BalanceSave = { kind: 'none' } | { kind: 'adjust'; delta: number } | { kind: 'opening'; amount: number }

/** Only a bank account can be overdrawn; cash, wallets and prepaid cards never hold less than nothing. */
export const allowsNegativeBalance = (type: PaymentMethodType): boolean => type === 'bank_account'

/** The pad's digits as a balance, the minus applied only where the account can go below zero. Null until it is a number. */
export function editedBalance(raw: string, negative: boolean, type: PaymentMethodType): number | null {
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) return null
  return negative && allowsNegativeBalance(type) && n !== 0 ? -n : n
}

/** The difference rounded to the currency's minor unit (fils for KWD, BHD, OMR, JOD; cents otherwise). */
export function balanceDelta(current: number, reported: number, currency = ''): number {
  const u = minorUnit(currency)
  return Math.round((reported - current) * u) / u
}

/** A tracked account records the rounded difference (none when it matches); an untracked one starts from the amount. */
export function balanceSave(tracked: boolean, current: number, reported: number, currency = ''): BalanceSave {
  if (!tracked) return { kind: 'opening', amount: reported }
  const delta = balanceDelta(current, reported, currency)
  return delta === 0 ? { kind: 'none' } : { kind: 'adjust', delta }
}
