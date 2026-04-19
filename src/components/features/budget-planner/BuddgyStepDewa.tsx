'use client'

import { useMemo } from 'react'
import { buildFiatCurrencyPickerOptions } from '@/lib/utils/currencyPickerOptions'
import { buddgyAmountBlurDisplay, sanitizeBuddgyAmountTyping } from '@/lib/budget/buddgyAmountInput'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'
import { BuddgyStepBack } from '@/components/features/budget-planner/BuddgyStepBack'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'

export function BuddgyStepDewa({ flow }: { flow: BuddgyFlowApi }) {
  const opts = buildFiatCurrencyPickerOptions(flow.settings)
  const items = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => opts.map((o) => ({ value: o.value, label: o.value, disabled: o.disabled })),
    [opts],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-brand-text-primary)] font-sans">What&apos;s your monthly DEWA?</p>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="w-[6.5rem]">
          <SelectField
            value={flow.incomeCurrency}
            onChange={(v) => flow.setIncomeCurrency(v as typeof flow.incomeCurrency)}
            items={items}
          />
        </div>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={flow.dewaAmount}
          onChange={(e) => flow.setDewaAmount(sanitizeBuddgyAmountTyping(e.target.value))}
          onBlur={() => flow.setDewaAmount(buddgyAmountBlurDisplay(flow.dewaAmount))}
          className="min-w-[140px] flex-1 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-brand-text-primary)]"
          placeholder="0.00"
        />
      </div>
      <div className="flex flex-col-reverse gap-4 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
        <BuddgyStepBack flow={flow} />
        {!flow.editPlanReturnViaSavings ?
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
        : null}
      </div>
    </div>
  )
}
