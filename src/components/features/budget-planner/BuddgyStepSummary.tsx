'use client'

import { motion } from 'framer-motion'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { totalExpenseBudgetFromPlan } from '@/lib/budget/budgetPlans'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'

function fmt(n: number, currency: string) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)} ${currency}`
}

const ghostOutlineClass =
  'cursor-pointer rounded-xl border border-[var(--color-brand-border)] bg-transparent px-5 py-2.5 text-sm font-semibold text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-text-muted)] transition-colors'

const primaryDoneClass =
  'cursor-pointer rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-5 py-2.5 text-sm font-semibold text-white'

export function BuddgyStepSummary({ flow }: { flow: BuddgyFlowApi }) {
  const { plan, incomeSources, settings, exchangeRates } = flow
  const income = calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
  const expenses = plan ? totalExpenseBudgetFromPlan(plan, settings.baseCurrency, exchangeRates) : 0
  const projected = income - expenses
  const rate = income > 0 ? Math.max(0, Math.min(100, Math.round((projected / income) * 100))) : 0

  const hasCategoryAmounts = expenses > 0.0001

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4 font-mono text-sm">
        <p className="text-sm font-sans text-[var(--color-brand-text-primary)] pb-1">You&apos;re all set! Here&apos;s your plan.</p>
        <div className="flex justify-between gap-4 text-[var(--color-brand-text-secondary)]">
          <span>Income</span>
          <span className="text-[var(--color-brand-text-primary)]">{fmt(income, settings.baseCurrency)}</span>
        </div>
        <div className="border-t border-[var(--color-brand-border)]" />
        <div className="flex justify-between gap-4 text-[var(--color-brand-text-secondary)]">
          <span>Total expenses</span>
          <span className="text-[var(--color-brand-text-primary)]">{fmt(expenses, settings.baseCurrency)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-brand-text-secondary)]">Projected savings</span>
          <motion.span
            className={projected >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.6, repeat: 2, ease: 'easeInOut' }}
          >
            {fmt(projected, settings.baseCurrency)}
          </motion.span>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4">
        {hasCategoryAmounts ?
          <>
            <p className="text-sm font-sans text-[var(--color-brand-text-primary)]">{rate}% savings rate — incredible! 🎉</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="button" onClick={() => flow.startEditPlanFromSummary()} className={ghostOutlineClass}>
                Edit Plan
              </button>
              <button type="button" onClick={() => flow.finishFlow()} className={primaryDoneClass}>
                Done
              </button>
            </div>
          </>
        : <>
            <p className="text-sm font-sans text-[var(--color-brand-text-secondary)]">
              It looks like your plan is empty. Let Buddgy rebuild it for you.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="button" onClick={() => flow.restartGuidedWizard()} className={ghostOutlineClass}>
                Rebuild with Buddgy
              </button>
              <button type="button" onClick={() => flow.startEditPlanFromSummary()} className={ghostOutlineClass}>
                Edit Plan
              </button>
              <button type="button" onClick={() => flow.finishFlow()} className={primaryDoneClass}>
                Done
              </button>
            </div>
          </>
        }
      </div>
    </div>
  )
}
