'use client'

import { useCallback } from 'react'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'

function fmt(n: number, currency: string) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)} ${currency}`
}

const activePill =
  'cursor-pointer rounded-full border border-transparent bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white shadow-sm'
const idlePill =
  'cursor-pointer rounded-full border border-[#2A2A38] bg-[#1A1A24] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A1A24]/90'

export function BuddgyStepSavings({ flow }: { flow: BuddgyFlowApi }) {
  const {
    maxSavings,
    savingsAmount,
    setSavingsAmount,
    settings,
    savingsMode,
    setSavingsMode,
  } = flow
  const pct = maxSavings > 0 ? Math.round((savingsAmount / maxSavings) * 100) : 0

  const onSlider = useCallback(
    (v: number) => {
      setSavingsMode('custom')
      const next = Math.max(0, Math.min(maxSavings, Math.round(v)))
      setSavingsAmount(next)
    },
    [maxSavings, setSavingsAmount, setSavingsMode]
  )

  const onMaximum = () => {
    setSavingsMode('maximum')
    setSavingsAmount(Math.round(maxSavings))
  }

  const onCustom = () => {
    setSavingsMode('custom')
    setSavingsAmount(Math.round(maxSavings * 0.25))
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-white font-sans">How much do you want to save?</p>
      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, maxSavings)}
          value={Math.min(savingsAmount, maxSavings)}
          onChange={(e) => onSlider(Number(e.target.value))}
          className="w-full accent-[var(--color-brand-red)]"
        />
        <div className="flex justify-between text-xs text-[var(--color-brand-text-muted)]">
          <span>0%</span>
          <span className="font-mono text-sm text-white">{pct}%</span>
          <span>100%</span>
        </div>
        <p className="text-center font-mono text-base text-white">
          {fmt(savingsAmount, settings.baseCurrency)} / month
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onMaximum} className={savingsMode === 'maximum' ? activePill : idlePill}>
          Maximum
        </button>
        <button type="button" onClick={onCustom} className={savingsMode === 'custom' ? activePill : idlePill}>
          Custom
        </button>
      </div>
    </div>
  )
}
