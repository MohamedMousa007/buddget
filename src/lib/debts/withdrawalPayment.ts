import type { Debt } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { moneyToGoldGrams } from '@/lib/utils/calculations'

interface Input {
  debt: Debt
  amount: number
  currency: string
  base: string
  rates: Record<string, number>
  goldPricePerGram: number
  goldAvailable: boolean
}

/** What a pocket withdrawal pays against a debt, in the debt's own unit. 0 = nothing can be paid (the caller must not withdraw). */
export function debtPaymentForWithdrawal({ debt, amount, currency, base, rates, goldPricePerGram, goldAvailable }: Input) {
  const amountInBase = convertCurrency(amount, currency, base, rates)
  const amountPaid = debt.isGold
    ? goldAvailable ? moneyToGoldGrams(amountInBase, goldPricePerGram, debt.goldKarat) : 0
    : convertCurrency(amount, currency, debt.currency, rates)
  return { amountPaid, amountInBase }
}
