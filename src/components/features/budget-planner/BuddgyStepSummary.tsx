'use client'

import { motion } from 'framer-motion'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import {
  effectivePlanCategoryAmountInBase,
  totalExpenseBudgetFromPlan,
} from '@/lib/budget/budgetPlans'
import { findCategoryByName } from '@/lib/budget/buddgyFlowHelpers'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'
import { BuddgyStepBack } from '@/components/features/budget-planner/BuddgyStepBack'

function fmt(n: number, currency: string) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)} ${currency}`
}

export function BuddgyStepSummary({ flow }: { flow: BuddgyFlowApi }) {
  const { plan, incomeSources, settings, exchangeRates } = flow
  const income = calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
  const expenses = plan ? totalExpenseBudgetFromPlan(plan, settings.baseCurrency, exchangeRates) : 0
  const savingsCat = plan ? findCategoryByName(plan, 'Savings') : undefined
  const savingsAmt =
    savingsCat ?
      effectivePlanCategoryAmountInBase(savingsCat, settings.baseCurrency, exchangeRates)
    : 0
  const rate = income > 0 ? Math.round((savingsAmt / income) * 100) : 0

  const hasCategoryAmounts = expenses > 0.0001 || savingsAmt > 0.0001

  return (
    <div className="space-y-5">
      <p className="text-sm text-white font-sans">You&apos;re all set! Here&apos;s your plan.</p>
      <div className="space-y-2 rounded-xl border border-[#2A2A38] bg-[#1A1A24] p-4 font-mono text-sm">
        <div className="flex justify-between gap-4 text-[var(--color-brand-text-secondary)]">
          <span>Income</span>
          <span className="text-white">{fmt(income, settings.baseCurrency)}</span>
        </div>
        <div className="border-t border-[#2A2A38]" />
        <div className="flex justify-between gap-4 text-[var(--color-brand-text-secondary)]">
          <span>Total expenses</span>
          <span className="text-white">{fmt(expenses, settings.baseCurrency)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-brand-text-secondary)]">Savings</span>
          <motion.span
            className="text-[var(--color-brand-green)]"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.6, repeat: 2, ease: 'easeInOut' }}
          >
            {fmt(savingsAmt, settings.baseCurrency)}
          </motion.span>
        </div>
      </div>

      {hasCategoryAmounts ?
        <p className="text-sm text-white font-sans">
          {rate}% savings rate — incredible! 🎉
        </p>
      : <div className="space-y-3 rounded-xl border border-[#2A2A38] bg-[#1A1A24] p-4">
          <p className="text-sm text-[var(--color-brand-text-secondary)]">
            It looks like your plan is empty. Let Buddgy rebuild it for you.
          </p>
          <button
            type="button"
            onClick={() => flow.restartGuidedWizard()}
            className="cursor-pointer rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)]"
          >
            Rebuild with Buddgy
          </button>
        </div>
      }

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => flow.restartGuidedWizard()}
          className="cursor-pointer rounded-xl border border-[#2A2A38] bg-[#1A1A24] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1A1A24]/90"
        >
          Adjust
        </button>
        <button
          type="button"
          onClick={() => flow.finishFlow()}
          className="cursor-pointer rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          Done
        </button>
        <BuddgyStepBack flow={flow} className="sm:ms-1" />
      </div>
    </div>
  )
}
