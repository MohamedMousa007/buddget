import type { Debt } from '@/lib/store/types'
import { cardHoldBack, cardPlansOf, cardUnbilledPlans, type CardRows, type Convert } from '@/lib/debt/computeCreditCardBalance'

export interface CardPlanLine {
  id: string
  name: string
  paidCount: number
  count: number
  /** One instalment, in the card's currency. */
  month: number
  /** Principal still owed, in the card's currency. */
  left: number
}

export interface CardPlanSummary {
  /** Open plans inside the card (§4.10). */
  plans: CardPlanLine[]
  /** Σ principal still owed on them: the "Y in N plans" part of Owed. */
  left: number
  /** Σ one instalment of each. */
  month: number
  /** What is due now (the card hold-back): owed minus plan principal not billed yet. The "Full amount" chip. */
  dueNow: number
  /** Plan instalments billed and not paid yet, inside `dueNow`. */
  plansDue: number
}

/** The card sheet's plan figures, read from the same lib functions as the card hold-back and Debts. */
export function cardPlanSummary(card: Debt, rows: Required<CardRows>, convert: Convert, ref: Date): CardPlanSummary {
  const toCard = (n: number, cur: string) => (cur === card.currency ? n : convert(n, cur, String(card.currency)) ?? 0)
  const plans = cardPlansOf(card, rows.debts, rows.expenses).filter((p) => p.status !== 'cleared').map((p) => {
    const paid = rows.payments.filter((x) => x.debtId === p.id)
    const per = p.installmentAmount ?? (p.installmentCount ? p.startingBalance / p.installmentCount : 0)
    return {
      id: p.id, name: p.name, paidCount: paid.length, count: p.installmentCount ?? 0,
      month: toCard(per, String(p.currency)),
      left: toCard(Math.max(0, p.startingBalance - paid.reduce((n, x) => n + x.amountPaid, 0)), String(p.currency)),
    }
  })
  const left = plans.reduce((n, p) => n + p.left, 0)
  return {
    plans,
    left,
    month: plans.reduce((n, p) => n + p.month, 0),
    dueNow: cardHoldBack(card, rows, convert, ref),
    plansDue: Math.max(0, left - cardUnbilledPlans(card, rows, convert, ref)),
  }
}
