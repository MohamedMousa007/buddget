'use client'

import { buildFiatCurrencyPickerOptions } from '@/lib/utils/currencyPickerOptions'
import { formatMoneyAmount } from '@/lib/budget/buddgyFlowHelpers'
import {
  buddgyAmountBlurDisplay,
  parseBuddgyAmountInput,
  sanitizeBuddgyAmountTyping,
} from '@/lib/budget/buddgyAmountInput'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'
import { BuddgyStepBack } from '@/components/features/budget-planner/BuddgyStepBack'

export function BuddgyStepIncome({ flow }: { flow: BuddgyFlowApi }) {
  const opts = buildFiatCurrencyPickerOptions(flow.settings)
  const restartNote =
    flow.flowMode === 'restart' &&
    flow.primaryIncomePreview &&
    flow.primaryIncomePreview.amount > 0 ?
      formatMoneyAmount(flow.primaryIncomePreview.amount, flow.primaryIncomePreview.currency)
    : null

  return (
    <div className="space-y-4">
      <p className="text-sm text-white font-sans">What&apos;s your monthly income?</p>
      {restartNote ?
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          Currently <span className="font-mono">{restartNote}</span> — update?
        </p>
      : null}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={flow.incomeCurrency}
          onChange={(e) => flow.setIncomeCurrency(e.target.value as typeof flow.incomeCurrency)}
          className="cursor-pointer rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-2 text-sm text-white"
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={flow.incomeAmount}
          onChange={(e) => flow.setIncomeAmount(sanitizeBuddgyAmountTyping(e.target.value))}
          onBlur={() => flow.setIncomeAmount(buddgyAmountBlurDisplay(flow.incomeAmount))}
          className="min-w-[140px] flex-1 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-3 py-2 font-mono text-sm text-white"
          placeholder="0.00"
        />
      </div>
      <div className="flex flex-col-reverse gap-4 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
        <BuddgyStepBack flow={flow} />
        {!flow.editPlanReturnViaSavings ?
          <button
            type="button"
            onClick={() => {
              const n = parseBuddgyAmountInput(flow.incomeAmount)
              flow.ensureIncome(n, flow.incomeCurrency)
              flow.advanceFromStep('income')
            }}
            className="cursor-pointer rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Next →
          </button>
        : null}
      </div>
    </div>
  )
}
