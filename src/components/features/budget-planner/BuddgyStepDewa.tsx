'use client'

import { buildFiatCurrencyPickerOptions } from '@/lib/utils/currencyPickerOptions'
import {
  buddgyAmountBlurDisplay,
  sanitizeBuddgyAmountTyping,
} from '@/lib/budget/buddgyAmountInput'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'
import { BuddgyStepBack } from '@/components/features/budget-planner/BuddgyStepBack'

export function BuddgyStepDewa({ flow }: { flow: BuddgyFlowApi }) {
  const opts = buildFiatCurrencyPickerOptions(flow.settings)

  return (
    <div className="space-y-4">
      <p className="text-sm text-white font-sans">What&apos;s your monthly DEWA?</p>
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
          value={flow.dewaAmount}
          onChange={(e) => flow.setDewaAmount(sanitizeBuddgyAmountTyping(e.target.value))}
          onBlur={() => flow.setDewaAmount(buddgyAmountBlurDisplay(flow.dewaAmount))}
          className="min-w-[140px] flex-1 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-3 py-2 font-mono text-sm text-white"
          placeholder="0.00"
        />
      </div>
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <BuddgyStepBack flow={flow} />
        <button
          type="button"
          onClick={() => {
            flow.saveDewa()
            flow.advanceFromStep('dewa')
          }}
          className="cursor-pointer rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
