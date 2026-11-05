import type { Debt } from '@/lib/store/types'
import { tryConvertWithGold } from '@/lib/utils/currency'
import { moneyToGoldGrams } from '@/lib/utils/calculations'

interface Input {
  debt: Debt
  amount: number
  currency: string
  base: string
  rates: Record<string, number>
  goldPricePerGram: number
  goldAvailable: boolean
  /** What is still owed, in the debt's own unit. */
  left?: number
}

/** What a pocket withdrawal pays against a debt, in the debt's own unit. 0 = nothing can be paid (the caller must not withdraw). `exceeds` = more than is still owed. */
export function debtPaymentForWithdrawal({ debt, amount, currency, base, rates, goldPricePerGram, goldAvailable, left }: Input) {
  const gold = { pricePerGram: goldPricePerGram, available: goldAvailable }
  const amountInBase = tryConvertWithGold(amount, currency, base, rates, base, gold) ?? 0
  const amountPaid = debt.isGold
    ? goldAvailable ? moneyToGoldGrams(amountInBase, goldPricePerGram, debt.goldKarat) : 0
    : tryConvertWithGold(amount, currency, debt.currency, rates, base, gold) ?? 0
  const exceeds = left !== undefined && amountPaid > left + (debt.isGold ? 1e-4 : 0.005)
  return { amountPaid, amountInBase, exceeds }
}
