'use client'

import type { Currency } from '@/lib/store/types'
import { formatMoneyAmount } from '@/lib/budget/buddgyFlowHelpers'

export function BuddgyRebuildPrompt({
  monthlyIncome,
  baseCurrency,
  onContinue,
  onCancel,
}: {
  monthlyIncome: number
  baseCurrency: Currency
  onContinue: () => void
  onCancel: () => void
}) {
  return (
    <div className="w-full max-w-md rounded-xl border border-[#2A2A38] bg-[#1A1A24] p-4 space-y-3 text-left">
      <p className="text-xs text-[var(--color-brand-text-muted)] leading-relaxed">
        {monthlyIncome > 0.0001 ?
          <>
            Currently{' '}
            <span className="font-mono text-white">
              {formatMoneyAmount(monthlyIncome, baseCurrency)}
            </span>{' '}
            income — update plan?
          </>
        : <>Replace your saved categories with a new Buddgy plan?</>}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="cursor-pointer rounded-lg bg-[var(--color-brand-red)] px-4 py-2 text-xs font-semibold text-white"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-[#2A2A38] bg-transparent px-4 py-2 text-xs font-medium text-[var(--color-brand-text-secondary)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
