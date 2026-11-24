import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { budgetMonthKeyFor } from '@/lib/utils/calculations'
import { computeMonthlyStats } from '@/lib/utils/monthlyStats'
import type { FinanceStore } from '@/lib/store/types'
import { buildInsightInput } from './buildInput'
import { heroAnswer } from './detectors'
import { computeInsights } from './rank'

/** The same hero and findings the page shows, computed outside React from a store snapshot (Buddgy's tool reads this). */
export function computeInsightsNow(s: FinanceStore, now = new Date()) {
  const st = computeMonthlyStats({
    expenses: s.expenses,
    incomeSources: s.incomeSources,
    incomeEvents: s.incomeEvents,
    budgetCategories: s.budgetCategories,
    budgetPlans: s.budgetPlans,
    budgetPlanActivations: s.budgetPlanActivations,
    activeBudgetPlanId: s.activeBudgetPlanId,
    savingsHoldings: s.savingsHoldings,
    savingsAccounts: s.savingsAccounts,
    savingsTransactions: s.savingsTransactions,
    debts: countedDebts(s.debts, s.paymentMethods),
    debtPayments: countedDebtPayments(s.debtPayments, s.debts, s.paymentMethods),
    settings: s.settings,
    exchangeRates: s.exchangeRates,
    goldPricePerGram: s.goldPricePerGram,
    goldPriceAvailable: s.goldPriceAvailable,
    monthFilter: budgetMonthKeyFor(now, s.settings.monthStartDay),
    trustLocalFinance: true,
  })
  const input = buildInsightInput(s, st.leftToSpend, now, !st.incomeBlocked)
  return { input, hero: heroAnswer(input), insights: computeInsights(input) }
}
