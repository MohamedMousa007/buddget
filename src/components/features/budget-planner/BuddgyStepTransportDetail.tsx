'use client'

import { parseBuddgyAmountInput, sanitizeBuddgyAmountTyping, buddgyAmountBlurDisplay } from '@/lib/budget/buddgyAmountInput'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'
import { BuddgyStepBack } from '@/components/features/budget-planner/BuddgyStepBack'

export function BuddgyStepTransportDetail({ flow }: { flow: BuddgyFlowApi }) {
  const mode = flow.transportMode
  if (!mode || mode === 'walk') return null
  const isPublic = mode === 'public'
  const monthlyPreview =
    isPublic ? parseBuddgyAmountInput(flow.transportPublicDaily) * 30 : parseBuddgyAmountInput(flow.transportCarMonthly)

  return (
    <div className="space-y-4">
      <p className="text-sm text-white font-sans">
        {isPublic ? 'Daily transport cost?' : 'Monthly fuel and parking?'}
      </p>
      {isPublic ?
        <>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={flow.transportPublicDaily}
            onChange={(e) => flow.setTransportPublicDaily(sanitizeBuddgyAmountTyping(e.target.value))}
            onBlur={() => flow.setTransportPublicDaily(buddgyAmountBlurDisplay(flow.transportPublicDaily))}
            className="w-full rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-3 py-2 font-mono text-sm text-white"
            placeholder="0.00"
          />
          <p className="text-xs text-[var(--color-brand-text-muted)] font-mono">
            ≈{' '}
            {new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(monthlyPreview)}{' '}
            {flow.settings.baseCurrency}/month
          </p>
        </>
      : <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={flow.transportCarMonthly}
          onChange={(e) => flow.setTransportCarMonthly(sanitizeBuddgyAmountTyping(e.target.value))}
          onBlur={() => flow.setTransportCarMonthly(buddgyAmountBlurDisplay(flow.transportCarMonthly))}
          className="w-full rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-3 py-2 font-mono text-sm text-white"
          placeholder="0.00"
        />
      }
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <BuddgyStepBack flow={flow} />
        <button
          type="button"
          onClick={() => {
            flow.saveTransportFromDetail()
            flow.advanceFromStep('transportDetail')
          }}
          className="cursor-pointer rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
