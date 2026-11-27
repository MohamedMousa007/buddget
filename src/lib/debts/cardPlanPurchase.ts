import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency } from '@/lib/store/types'
import { cardPlanPurchaseCharge } from '@/lib/debt/computeCreditCardBalance'
import { isCardPlan } from '@/lib/debt/bnpl'
import { uuidFromText } from '@/lib/savings/partId'
import { localTodayISO } from '@/lib/utils/localDate'

/** The purchase charge of a card plan has one id per plan, so a retry or a second device writes the same row. */
export const cardPlanPurchaseId = (planId: string): string => uuidFromText(`cardplan-purchase|${planId}`)

/**
 * A new card plan's purchase (LOGIC_SPEC §4.10): one full-price charge on the card, spending at purchase, so the plan is
 * owed exactly once (inside the card) from day one. A charge already on the card for it (linked, or the same price within
 * 3 days) is linked instead of written again. Returns the id of the charge it wrote, or null.
 */
export function bookCardPlanPurchase(planId: string, today: string = localTodayISO()): string | null {
  const s = useFinanceStore.getState()
  const plan = s.debts.find((d) => d.id === planId)
  if (!plan || !isCardPlan(plan) || plan.isGold || !(plan.startingBalance > 0)) return null
  const card = s.debts.find((d) => d.id === plan.linkedCreditCardDebtId)
  const cardPmId = card?.linkedPaymentMethodId
  if (!card || !cardPmId) return null
  const id = cardPlanPurchaseId(plan.id)
  if (s.expenses.some((e) => e.id === id)) return null
  const existing = cardPlanPurchaseCharge(plan, card, s.expenses, [today])
  if (existing) {
    if (existing.linkedDebtId !== plan.id) s.updateExpense(existing.id, { linkedDebtId: plan.id })
    return null
  }
  s.addExpense({
    id,
    date: today,
    description: plan.name,
    category: 'Shopping',
    amount: plan.startingBalance,
    currency: plan.currency as Currency,
    paymentMethodId: cardPmId,
    isRecurring: false,
    linkedDebtId: plan.id,
  })
  return id
}
