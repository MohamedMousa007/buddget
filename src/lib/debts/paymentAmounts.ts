import type { DebtPayment } from '@/lib/store/types'

/**
 * What the user actually handed over, in the currency they paid in. `amountPaid` is in debt units
 * (it drives the balance), so a cross-currency payment must not be displayed or posted to an account from it.
 * Legacy rows carry no original amount and fall back to the debt-unit figure.
 */
export function paidAsEntered(p: DebtPayment, fallbackCurrency: string): { amount: number; currency: string } {
  return { amount: p.originalAmount ?? p.amountPaid, currency: p.paymentCurrency ?? fallbackCurrency }
}

/** The paired expense is money: grams (XAU) are booked at their base-currency value, other currencies as entered. */
export function paymentExpenseMoney(
  amount: number,
  paymentCurrency: string,
  amountInBase: number,
  baseCurrency: string
): { amount: number; currency: string } {
  return paymentCurrency === 'XAU'
    ? { amount: amountInBase, currency: baseCurrency }
    : { amount, currency: paymentCurrency }
}
