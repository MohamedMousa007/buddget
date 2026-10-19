'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { differenceInCalendarDays } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useGoalRows } from '@/hooks/useGoalRows'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { debtExtras, debtPaidByDebt, goalExtras, liquidSavings, liveDebts, paydayDayOf, subscriptionsExtras, subscriptionsLive } from '@/lib/budget/liveLinks'
import { lineHistory, spendByLine } from '@/lib/budget/lineSpend'
import { buildPlanView } from '@/lib/budget/planView'
import type { PlanMode, PlanView } from '@/lib/budget/planView.types'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { deriveSimpleMonth } from '@/lib/savings/simpleMonth'
import { getMonthRange, projectedIncomeForMonth } from '@/lib/utils/calculations'

const DEFAULT_TARGET_MONTHS = 3

/**
 * The Budget page's single read model: the active plan joined with income, spend, subscriptions,
 * debts, goals and savings for the selected cycle. Null when there is no live plan. The caller
 * hydrates the stores.
 */
export function usePlanView(mode: PlanMode): PlanView | null {
  const stats = useMonthlyStats()
  const goalRows = useGoalRows()
  const { monthFilter } = useSettingsStore()
  const s = useFinanceStore(
    useShallow((st) => ({
      profile: st.profile,
      settings: st.settings,
      incomeSources: st.incomeSources,
      incomeEvents: st.incomeEvents,
      expenses: st.expenses,
      subscriptions: st.subscriptions,
      debts: st.debts,
      debtPayments: st.debtPayments,
      savingsAccounts: st.savingsAccounts,
      exchangeRates: st.exchangeRates,
      budgetCategories: st.budgetCategories,
      budgetPlans: st.budgetPlans,
      activeBudgetPlanId: st.activeBudgetPlanId,
      goldPricePerGram: st.goldPricePerGram,
      goldPriceAvailable: st.goldPriceAvailable,
    }))
  )

  return useMemo(() => {
    const plan = selectActivePlan(s.budgetPlans, s.activeBudgetPlanId)
    if (!plan) return null

    const now = new Date()
    const base = s.settings.baseCurrency
    const rates = s.exchangeRates
    const startDay = s.settings.monthStartDay
    const { start, end } = getMonthRange(monthFilter, startDay)
    const daysInCycle = differenceInCalendarDays(end, start) + 1
    const dayOfCycle = Math.min(daysInCycle, Math.max(1, differenceInCalendarDays(now, start) + 1))

    const debtCtx = {
      debtPayments: s.debtPayments, expenses: s.expenses, base, rates,
      goldPricePerGram: s.goldPricePerGram, goldPriceAvailable: s.goldPriceAvailable,
    }
    const debtPaid = debtPaidByDebt(s.debts, debtCtx, monthFilter, startDay)
    const spend = mode === 'month'
      ? spendByLine({ plan, spendingByEnum: stats.spendingByEnum, debtPaid })
      : { byLine: {}, unassigned: 0 }
    const history = lineHistory({
      plan, expenses: s.expenses, monthKey: monthFilter, monthStartDay: startDay, base, rates,
      debtPaidForMonth: (key) => debtPaidByDebt(s.debts, debtCtx, key, startDay),
    })

    const config = s.profile.emergencyFundConfig
    const subs = subscriptionsLive(s.subscriptions, base, rates, now)
    return buildPlanView({
      plan,
      mode,
      base,
      rates,
      now,
      projectedIncome: stats.incomeBlocked ? 0 : projectedIncomeForMonth(s.incomeSources, base, rates, monthFilter, startDay),
      cycle: { start, dayOfCycle, daysInCycle },
      paydayDay: paydayDayOf(s.incomeSources, now),
      spentByLine: spend.byLine,
      averageByLine: history.average,
      monthsOverCapByLine: history.monthsOverCap,
      unassignedSpend: spend.unassigned,
      subscriptions: {
        monthly: subs.monthly,
        extras: subscriptionsExtras({ subs: s.subscriptions, cycleExpenses: stats.monthlyExpenses, today: now, cycleStart: start, cycleEnd: end, base, rates }),
      },
      debts: liveDebts(s.debts, debtCtx).map((d) => debtExtras(d, debtPaid[d.debt.id] ?? 0, debtCtx)),
      goals: goalExtras(goalRows, fundingBasis(s, now).usualKeep, base, rates),
      safety: {
        liquid: liquidSavings(s.savingsAccounts, base, rates, s.goldPricePerGram, s.goldPriceAvailable),
        essentialsMonthly: deriveSimpleMonth({
          profile: s.profile, activePlan: plan, debts: s.debts, baseCurrency: base, exchangeRates: rates,
          override: config?.monthlyEssentials,
        }).total,
        targetMonths: config?.targetMonths ?? DEFAULT_TARGET_MONTHS,
      },
    })
  }, [s, stats, goalRows, monthFilter, mode])
}
