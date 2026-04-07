'use client'

import { motion } from 'framer-motion'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import {
  effectivePlanCategoryAmountInBase,
  totalExpenseBudgetFromPlan,
} from '@/lib/budget/budgetPlans'
import { findCategoryByName } from '@/lib/budget/buddgyFlowHelpers'
import type { BuddgyFlowApi, BuddgyFlowStep } from '@/hooks/useBuddgyFlow'
import { BuddgyStepBack } from '@/components/features/budget-planner/BuddgyStepBack'

function fmt(n: number, currency: string) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)} ${currency}`
}

function dotLabel(step: BuddgyFlowStep): string {
  switch (step) {
    case 'income':
      return 'Income'
    case 'household':
      return 'Household'
    case 'rent':
      return 'Rent'
    case 'dewa':
      return 'DEWA'
    case 'transportMode':
    case 'transportDetail':
      return 'Transport'
    case 'savings':
      return 'Savings'
    default:
      return ''
  }
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
  const order = flow.buildBuddgyFlowOrder(plan)
  const activeDotIndex = order.length > 0 ? order.length - 1 : 0

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

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1" role="tablist" aria-label="Wizard steps">
        {order.map((s, i) => {
          const active = i === activeDotIndex
          return (
            <button
              key={`${s}-${i}`}
              type="button"
              role="tab"
              aria-selected={active}
              title={dotLabel(s)}
              onClick={() => flow.navigateToDotFromSummary(i)}
              className={
                active ?
                  'h-2.5 w-2.5 rounded-full bg-[var(--color-brand-red)] ring-2 ring-[var(--color-brand-red)]/40'
                : 'h-2 w-2 rounded-full bg-[#3A3A48] hover:bg-[#5A5A72]'
              }
            />
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
      </div>
      <BuddgyStepBack flow={flow} />
    </div>
  )
}
