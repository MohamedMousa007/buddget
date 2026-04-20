'use client'

import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { readI18n } from '@/components/features/onboarding/journey/cards/InfoCard'
import type { GateCard } from '@/lib/onboarding/journeyTypes'

/**
 * A binary yes/no question that sets an answer slot. When "No", the
 * runner's `condition` predicate on the *next* card (the matching
 * ModalCard) returns false and the card is auto-skipped.
 */
export interface OnboardingGateCardProps {
  card: GateCard
  value: 'yes' | 'no' | undefined
  onChange: (next: 'yes' | 'no') => void
}

export function OnboardingGateCard({ card, value, onChange }: OnboardingGateCardProps) {
  const t = useT()
  const hint = card.hintKey ? readI18n(t, card.hintKey) : null

  const options: Array<{ value: 'yes' | 'no'; label: string }> = [
    { value: 'yes', label: t.common.yes },
    { value: 'no', label: t.common.no },
  ]

  return (
    <div className="space-y-4">
      {hint ? (
        <p className="text-xs text-[var(--color-brand-text-muted)] text-center sm:text-start">
          {hint}
        </p>
      ) : null}
      <div role="radiogroup" className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={cn(
                'rounded-2xl border px-4 py-4 text-base font-semibold transition-colors',
                'bg-[var(--color-brand-card)]',
                selected
                  ? 'border-[var(--color-brand-red)] ring-2 ring-[var(--color-brand-red)]/20 text-[var(--color-brand-text-primary)]'
                  : 'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-text-muted)]',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
