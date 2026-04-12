import type { BudgetPlan, Currency, IncomeSource } from '@/lib/store/types'
import type { BudgetPlannerContextPayload } from '@/lib/ai/buddgyBudgetPlannerPrompt'
import { predefinedBudgetCategoryLabelsForPrompt } from '@/lib/budget/budgetPlannerPresets'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'

export function buildBudgetPlannerContextPayload(input: {
  plan: BudgetPlan
  baseCurrency: Currency
  secondaryCurrency: Currency | null
  noIncomeDeclared: boolean
  incomeSources: IncomeSource[]
  exchangeRates: Record<string, number>
  country: string
  city: string
  builderMode: boolean
}): BudgetPlannerContextPayload {
  const monthly = calculateMonthlyIncome(input.incomeSources, input.baseCurrency, input.exchangeRates)
  const incomeSummary =
    input.noIncomeDeclared && input.incomeSources.length === 0
      ? 'Not declared in the app yet'
      : `${monthly} ${input.baseCurrency}/month (${input.incomeSources.length} income source(s))`
  const planSummary =
    input.plan.categories.length === 0
      ? '(no rows yet)'
      : input.plan.categories
          .map((c) => `${c.icon} ${c.name}: ${c.amount} ${c.currency ?? input.baseCurrency}`)
          .join('; ')

  return {
    builderMode: input.builderMode,
    activePlanId: input.plan.id,
    primaryCurrency: input.baseCurrency,
    secondaryCurrency: input.secondaryCurrency,
    incomeSummary,
    country: input.country,
    city: input.city,
    existingPlanSummary: planSummary,
    predefinedCategoryLabels: predefinedBudgetCategoryLabelsForPrompt(),
  }
}
