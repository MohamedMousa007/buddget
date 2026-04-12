'use client'

import { useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import type { RegenerateTweak } from '@/lib/budget/buddgyBuilderRedistribution'

const PILLS: { tweak: RegenerateTweak; label: string }[] = [
  { tweak: 'more_savings', label: 'More savings' },
  { tweak: 'better_lifestyle', label: 'Better lifestyle' },
  { tweak: 'lower_rent', label: 'Lower rent' },
  { tweak: 'less_dining', label: 'Less dining out' },
  { tweak: 'something_else', label: 'Something else' },
]

export interface BuddgyRegenerateFeedbackProps {
  onRegenerate: (tweak: RegenerateTweak, customNote: string | null) => void
  onCancel: () => void
  disabled?: boolean
  loading?: boolean
}

/**
 * Pick feedback, optionally type a note, then confirm — never auto-runs on pill tap.
 */
export function BuddgyRegenerateFeedback({
  onRegenerate,
  onCancel,
  disabled,
  loading,
}: BuddgyRegenerateFeedbackProps) {
  const [selected, setSelected] = useState<RegenerateTweak | null>(null)
  const [other, setOther] = useState('')

  const canRun =
    selected &&
    (selected !== 'something_else' || other.trim().length > 0) &&
    !disabled &&
    !loading

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4 space-y-3">
      <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">What would you change?</p>
      <div className="flex flex-wrap gap-2">
        {PILLS.map(({ tweak, label }) => (
          <button
            key={tweak}
            type="button"
            disabled={disabled || loading}
            onClick={() => setSelected(tweak)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected === tweak
                ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)]/50'
            } disabled:opacity-40`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected === 'something_else' ?
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-brand-text-muted)]">Tell us what to change:</p>
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value)}
            rows={3}
            placeholder="e.g. Add remittance and reduce entertainment…"
            className="w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2 text-xs text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] resize-y"
          />
        </div>
      : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={!canRun}
          onClick={() => {
            if (!selected || !canRun) return
            onRegenerate(selected, selected === 'something_else' ? other.trim() : null)
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 transition-colors"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Regenerate plan
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] px-2"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
