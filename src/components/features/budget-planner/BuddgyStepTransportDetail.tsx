'use client'

import { parseBuddgyAmountInput, sanitizeBuddgyAmountTyping, buddgyAmountBlurDisplay } from '@/lib/budget/buddgyAmountInput'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'

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
    </div>
  )
}
