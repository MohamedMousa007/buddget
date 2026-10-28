import type { Currency, Expense, GoalCategory } from '@/lib/store/types'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { expenseAmountInBase } from '@/lib/utils/calculations'

export type FieldAdvice = { kind: 'emergency'; amount: number } | { kind: 'covered' } | null

/** Average monthly non-savings spend over the last three full months (base currency); null without history. */
export function averageMonthlySpend(
  expenses: Pick<Expense, 'date' | 'category' | 'spendExclusion' | 'amount' | 'currency' | 'amountInBaseCurrency' | 'refundKind'>[],
  now: Date,
  baseCurrency: Currency,
  rates: Record<string, number>
): number | null {
  const months = [1, 2, 3].map((i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const totals = months
    .map((m) =>
      expenses
        .filter((e) => e.date.startsWith(m) && !isNonSpendExpense(e))
        .reduce((s, e) => s + expenseAmountInBase(e, baseCurrency, rates), 0)
    )
    .filter((t) => t > 0)
  return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null
}

/** Buddgy's one-line advice under the Target Amount field, from what the user has entered and their real spending. */
export function fieldAdvice(input: {
  category: GoalCategory
  target: number
  saved: number
  monthlySpendInCcy: number | null
}): FieldAdvice {
  if (input.target > 0 && input.saved >= input.target) return { kind: 'covered' }
  if (input.category === 'emergency_fund' && !(input.target > 0) && input.monthlySpendInCcy)
    return { kind: 'emergency', amount: Math.round((input.monthlySpendInCcy * 3) / 100) * 100 }
  return null
}
