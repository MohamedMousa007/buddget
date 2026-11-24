import type { Debt, DebtPayment } from '@/lib/store/types'
import { isOwedToUser } from './debtDirection'
import { paidAsEntered } from './paymentAmounts'

export interface RepaymentReceived {
  id: string
  debtId: string
  person: string
  amount: number
  currency: string
  /** Local `yyyy-MM-dd`. */
  date: string
  occurredAt?: string
  paymentMethodId?: string
}

/**
 * Money someone paid back on a debt owed to the user: money in, kept apart from earned income. The debt payment is
 * the only record of it (no income event, no expense), so Flow lists it from here.
 */
export function repaymentsReceived(debts: readonly Debt[], payments: readonly DebtPayment[], inRange: (day: string) => boolean): RepaymentReceived[] {
  const owed = new Map(debts.filter(isOwedToUser).map((d) => [d.id, d]))
  const out: RepaymentReceived[] = []
  for (const p of payments) {
    const d = owed.get(p.debtId)
    if (!d || !inRange(p.date)) continue
    // A legacy gold payment recorded grams only: there is no money amount to show.
    if (d.isGold && p.originalAmount == null) continue
    const paid = paidAsEntered(p, String(d.currency))
    out.push({
      id: p.id,
      debtId: d.id,
      person: d.person || d.name,
      amount: paid.amount,
      currency: paid.currency,
      date: p.date.slice(0, 10),
      occurredAt: p.occurredAt,
      paymentMethodId: p.paymentMethodId,
    })
  }
  return out
}
