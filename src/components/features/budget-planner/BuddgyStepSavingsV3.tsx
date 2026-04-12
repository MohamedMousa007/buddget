'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'

const PRESETS: { label: string; percent: number }[] = [
  { label: 'Maximum', percent: 100 },
  { label: 'Balanced', percent: 70 },
  { label: 'Custom', percent: -1 },
]

/**
 * Step 3: Savings allocation — slider + presets.
 * Shows remaining amount after expenses and lets user choose savings %.
 */
export function BuddgyStepSavingsV3({ flow }: { flow: BuddgyBuilderApi }) {
  const { remaining, savingsPercent, setSavingsPercent, savingsAmount, bufferAmount, loading, generatePlan, basics } = flow

  const activePreset = savingsPercent === 100 ? 'Maximum' : savingsPercent === 70 ? 'Balanced' : 'Custom'

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-brand-text-primary)]">
        This leaves you{' '}
        <span className="font-mono font-semibold text-[var(--color-brand-green)]">
          {basics.currency} {remaining.toLocaleString()}
        </span>{' '}
        to split.
      </p>

      {/* Slider */}
      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={savingsPercent}
          onChange={(e) => setSavingsPercent(Number(e.target.value))}
          className="w-full accent-[var(--color-brand-red)]"
        />
        <div className="flex items-center justify-between text-xs text-[var(--color-brand-text-muted)]">
          <span>0%</span>
          <span className="font-mono text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {savingsPercent}%
          </span>
          <span>100%</span>
        </div>
      </div>

      {/* Savings/Buffer display */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3 text-center">
          <p className="text-xs text-[var(--color-brand-text-muted)]">Savings</p>
          <p className="font-mono text-lg font-bold text-[var(--color-brand-green)]">
            {basics.currency} {savingsAmount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3 text-center">
          <p className="text-xs text-[var(--color-brand-text-muted)]">Buffer</p>
          <p className="font-mono text-lg font-bold text-[var(--color-brand-text-primary)]">
            {basics.currency} {bufferAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Presets */}
      <div className="flex gap-2 justify-center">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              if (p.percent >= 0) setSavingsPercent(p.percent)
            }}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
              activePreset === p.label
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {flow.error && (
        <p className="text-xs text-[var(--color-brand-red)]">{flow.error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={generatePlan}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Build my plan
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
