'use client'

import { useMemo } from 'react'
import { Flame } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { GoalRow } from '@/hooks/useGoalRows'
import { useT } from '@/lib/i18n'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { debtMonthlyRate, goalLedger } from '@/lib/goals/debtGoal'
import { goalInsight, goalMonthlyRate } from '@/lib/goals/goalDetail'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

/** One sentence under the header: milestones reached this year and the next checkpoint in sight. Hidden when empty. */
export function GoalsInsight({ rows, className }: { rows: GoalRow[]; className?: string }) {
  const t = useT().goals.home
  const s = useFinanceStore(
    useShallow((st) => ({
      incomeEvents: st.incomeEvents, incomeSources: st.incomeSources, expenses: st.expenses, budgetCategories: st.budgetCategories,
      budgetPlans: st.budgetPlans, activeBudgetPlanId: st.activeBudgetPlanId, exchangeRates: st.exchangeRates, settings: st.settings, txs: st.savingsTransactions,
      debts: st.debts, debtPayments: st.debtPayments,
    })),
  )
  const insight = useMemo(() => {
    const now = new Date()
    const keepBase = fundingBasis(s, now).usualKeep
    const current = new Map(rows.map((r) => [r.goal.id, r.current]))
    return goalInsight({
      goals: rows.map((r) => r.goal),
      currentFor: (g) => current.get(g.id) ?? 0,
      ledgerFor: (g) => goalLedger(g, { savingsTransactions: s.txs, debts: s.debts, debtPayments: s.debtPayments }),
      toGoal: (g) => (a, c) => convertCurrency(a, c, g.currency, s.exchangeRates),
      rateFor: (g) => g.category === 'debt_freedom' ? debtMonthlyRate(g, s.debts, s.exchangeRates) : goalMonthlyRate(g, keepBase === null ? null : convertCurrency(keepBase, s.settings.baseCurrency, g.currency, s.exchangeRates)),
      now,
    })
  }, [rows, s])

  if (insight.milestones === 0 && !insight.next) return null
  return (
    <p className={cn('flex items-start gap-2 text-sm text-[var(--color-brand-text-secondary)]', className)}>
      <Flame className="mt-0.5 size-[18px] shrink-0 text-[var(--color-brand-amber)]" aria-hidden />
      <span>
        {insight.milestones > 0 ? (
          <>
            <b className="font-semibold text-[var(--color-brand-text-primary)]">{t.insightMilestones(insight.milestones)}</b> {t.insightYear}{' '}
          </>
        ) : null}
        {insight.next ? t.insightNext(insight.next.name, insight.next.pct, t.insightIn(insight.next.days)) : null}
      </span>
    </p>
  )
}
