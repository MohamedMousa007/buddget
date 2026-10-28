import type { Debt } from '@/lib/store/types'

export const isOwedToUser = (d: Pick<Debt, 'direction'>): boolean => d.direction === 'they_owe'

/** Payments on these debts never create an expense: the charge lives on the card, or the money comes in. */
export const settlesWithoutExpense = (d: Pick<Debt, 'debtType' | 'direction'>): boolean =>
  d.debtType === 'credit_card' || isOwedToUser(d)
