import type { Currency, Debt, DebtPayment } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { goldGramsToMoney, totalPaidTowardDebt } from '@/lib/utils/calculations'

/**
 * Total amount paid toward a debt, converted to `goalCurrency` for goal progress.
 */
export function debtPaidAmountInCurrency(
  debt: Debt,
  debtPayments: DebtPayment[],
  goalCurrency: Currency,
  exchangeRates: Record<string, number>,
  goldPricePerGram: number,
  goldPriceAvailable: boolean
): number {
  const paid = totalPaidTowardDebt(debt.id, debtPayments)
  if (debt.isGold) {
    if (!goldPriceAvailable) return 0
    const aedValue = goldGramsToMoney(paid, goldPricePerGram, debt.goldKarat ?? 24)
    return convertCurrency(aedValue, 'AED', goalCurrency, exchangeRates)
  }
  return convertCurrency(paid, debt.currency, goalCurrency, exchangeRates)
}
