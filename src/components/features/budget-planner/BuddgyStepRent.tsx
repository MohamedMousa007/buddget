'use client'

import { buildFiatCurrencyPickerOptions } from '@/lib/utils/currencyPickerOptions'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'

export function BuddgyStepRent({ flow }: { flow: BuddgyFlowApi }) {
  const opts = buildFiatCurrencyPickerOptions(flow.settings)

  return (
    <div className="space-y-4">
      <p className="text-sm text-white font-sans">How much is rent?</p>
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
          value={flow.rentAmount}
          onChange={(e) => flow.setRentAmount(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-3 py-2 font-mono text-sm text-white"
          placeholder="0"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-brand-text-secondary)]">
        <input
          type="checkbox"
          checked={flow.rentIncludes}
          onChange={(e) => flow.setRentIncludes(e.target.checked)}
          className="h-4 w-4 rounded border-[#2A2A38] bg-[#1A1A24]"
        />
        Includes utilities
      </label>
      <button
        type="button"
        onClick={() => {
          flow.saveRent()
          if (!flow.rentIncludes) flow.setStep('dewa')
          else flow.setStep('transportMode')
        }}
        className="cursor-pointer rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-5 py-2.5 text-sm font-semibold text-white"
      >
        Next →
      </button>
    </div>
  )
}
