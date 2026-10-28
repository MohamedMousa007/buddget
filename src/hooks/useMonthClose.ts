'use client'

import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { differenceInCalendarDays } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { cycleKeyOf, planForMonth } from '@/lib/budget/activations'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { lineBlock } from '@/lib/budget/blocks'
import { effectivePlanCategoryAmountInBase } from '@/lib/budget/budgetPlans'
import { debtPaidByDebt } from '@/lib/budget/liveLinks'
import { ledgerDebtPaidByDebt, lineHistory, shiftMonth, spendByLine } from '@/lib/budget/lineSpend'
import { buildClose, type CloseLine, type MonthClose } from '@/lib/budget/monthClose'
import { closeKey } from '@/lib/budget/closeMemory'
import { calculateCategorySpending, filterExpensesByMonth, getMonthRange } from '@/lib/utils/calculations'

/** The close prompt stays up for this many days into the new cycle, then stops nagging. */
const PROMPT_DAYS = 15

export interface MonthCloseState extends MonthClose {
  /** `YYYY-MM` of the cycle being closed. */
  cycleKey: string
}

/** What the last finished cycle says about the active plan, or null when there is nothing to close. */
export function useMonthClose(): MonthCloseState | null {
  const s = useFinanceStore(
    useShallow((st) => ({
      plans: st.budgetPlans,
      activations: st.budgetPlanActivations,
      activeId: st.activeBudgetPlanId,
      expenses: st.expenses,
      debts: countedDebts(st.debts, st.paymentMethods),
      debtPayments: countedDebtPayments(st.debtPayments, st.debts, st.paymentMethods),
      rates: st.exchangeRates,
      settings: st.settings,
      goldPricePerGram: st.goldPricePerGram,
      goldPriceAvailable: st.goldPriceAvailable,
      closeMemory: st.profile.financialProfile?.closeMemory,
    })),
  )
  const closed = useSettingsStore((st) => st.budgetClosedCycles)

  return useMemo(() => {
    const now = new Date()
    const startDay = s.settings.monthStartDay
    const base = s.settings.baseCurrency
    const currentKey = cycleKeyOf(now, startDay)
    const cycleKey = shiftMonth(currentKey, -1)
    if (closed.includes(cycleKey)) return null
    if (differenceInCalendarDays(now, getMonthRange(currentKey, startDay).start) + 1 > PROMPT_DAYS) return null

    const plan = planForMonth(s.plans, s.activations, cycleKey, s.activeId)
    if (!plan || plan.id !== selectActivePlan(s.plans, s.activeId)?.id || plan.categories.length === 0) return null

    const spending = calculateCategorySpending(filterExpensesByMonth(s.expenses, cycleKey, startDay), base, s.rates)
    if (Object.keys(spending).length === 0) return null

    const debtCtx = {
      debtPayments: s.debtPayments, expenses: s.expenses, base, rates: s.rates,
      goldPricePerGram: s.goldPricePerGram, goldPriceAvailable: s.goldPriceAvailable,
    }
    const spent = spendByLine({ plan, spendingByEnum: spending, debtPaid: debtPaidByDebt(s.debts, debtCtx, cycleKey, startDay), debtLedgerPaid: ledgerDebtPaidByDebt(s.expenses, cycleKey, startDay, base, s.rates) }).byLine
    const history = lineHistory({
      plan, expenses: s.expenses, monthKey: currentKey, monthStartDay: startDay, base, rates: s.rates,
      debtPaidForMonth: (key) => debtPaidByDebt(s.debts, debtCtx, key, startDay),
    })

    const lines: CloseLine[] = plan.categories.map((c) => ({
      id: c.id,
      key: closeKey(lineBlock(c), c.name),
      name: c.name,
      block: lineBlock(c),
      cap: effectivePlanCategoryAmountInBase(c, base, s.rates),
      spent: spent[c.id] ?? 0,
      average: history.average[c.id] ?? null,
      monthsOver: history.monthsOverCap[c.id] ?? 0,
      locked: !!c.locked,
      linked: (c.linkType ?? 'none') !== 'none',
    }))
    return { cycleKey, ...buildClose(lines, { past: s.closeMemory, cycleKey }) }
  }, [s, closed])
}
