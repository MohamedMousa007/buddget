import type { Debt, PaymentMethod } from '@/lib/store/types'

/**
 * A BNPL plan is an `installment` debt whose linked payment method is a `bnpl`
 * account (Tabby, Tamara, valU…). This is the differentiator for the non-spend
 * settlement rule: BNPL purchases are counted as spend at checkout, so each
 * installment payment is a settlement (category `Installment`, non-spend), NOT a
 * `Debt`-category spend the way a bank installment plan's payments are.
 *
 * We key off the linked PM's `type`, not `installmentProvider`, so any BNPL brand
 * (incl. valU/Sympl beyond the small `InstallmentProvider` enum) is covered.
 */
export function isBnplPlan(debt: Debt, paymentMethods: PaymentMethod[]): boolean {
  if (debt.debtType !== 'installment' || !debt.linkedPaymentMethodId) return false
  const pm = paymentMethods.find((m) => m.id === debt.linkedPaymentMethodId)
  return pm?.type === 'bnpl'
}

/** A card plan: an instalment plan that lives inside a credit card (LOGIC_SPEC §4.10). Owed once, as part of the card. */
export const isCardPlan = (debt: Pick<Debt, 'debtType' | 'linkedCreditCardDebtId'>): boolean =>
  debt.debtType === 'installment' && !!debt.linkedCreditCardDebtId

/** Plans whose purchase was spending at checkout: each instalment written from now on is a non-spend `Installment` settlement. */
export const isSettlementPlan = (debt: Debt, paymentMethods: PaymentMethod[]): boolean =>
  isBnplPlan(debt, paymentMethods) || isCardPlan(debt)
