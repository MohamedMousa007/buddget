'use client'

import { useState } from 'react'
import type { RegenerateTweak } from '@/lib/budget/buddgyBuilderRedistribution'

const PILLS: { tweak: RegenerateTweak; label: string }[] = [
  { tweak: 'more_savings', label: 'More savings' },
  { tweak: 'better_lifestyle', label: 'Better lifestyle' },
  { tweak: 'lower_rent', label: 'Lower rent' },
  { tweak: 'less_dining', label: 'Less dining out' },
  { tweak: 'something_else', label: 'Something else' },
]

export interface BuddgyRegenerateFeedbackProps {
  onSubmit: (tweak: RegenerateTweak, customNote: string | null) => void
  onCancel: () => void
  disabled?: boolean
}

/**
 * Quick pill selector before rebuilding numbers without restarting the wizard.
 */
export function BuddgyRegenerateFeedback({ onSubmit, onCancel, disabled }: BuddgyRegenerateFeedbackProps) {
  const [other, setOther] = useState('')

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4 space-y-3">
      <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">What would you change?</p>
      <div className="flex flex-wrap gap-2">
        {PILLS.map(({ tweak, label }) => (
          <button
            key={tweak}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (tweak === 'something_else') {
                onSubmit(tweak, other.trim() || null)
              } else {
                onSubmit(tweak, null)
              }
            }}
            className="rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)]/50 hover:text-[var(--color-brand-text-primary)] disabled:opacity-40 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={other}
        onChange={(e) => setOther(e.target.value)}
        placeholder="Optional note for “Something else”…"
        className="w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2 text-xs text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
      />
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]"
      >
        Cancel
      </button>
    </div>
  )
}
