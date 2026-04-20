'use client'

import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { readI18n } from '@/components/features/onboarding/journey/cards/InfoCard'
import type { FieldCard as FieldCardModel } from '@/lib/onboarding/journeyTypes'

/**
 * Renders a single-question card. Dispatches on `card.input.type` to a
 * small widget. Text, country, currency, and yes-no variants land in
 * later commits; this commit ships `single-select` only (the Quick vs
 * Guided path fork needs it).
 */
export interface FieldCardProps {
  card: FieldCardModel
  value: unknown
  onChange: (next: unknown) => void
}

export function FieldCard({ card, value, onChange }: FieldCardProps) {
  const t = useT()
  const hint = card.hintKey ? readI18n(t, card.hintKey) : null

  return (
    <div className="space-y-4">
      {hint ? (
        <p className="text-xs text-[var(--color-brand-text-muted)] leading-relaxed text-center sm:text-start">
          {hint}
        </p>
      ) : null}

      {card.input.type === 'single-select' ? (
        <SingleSelectField
          options={card.input.options}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      ) : (
        // Placeholder: other widgets (text, country, currency, yes-no)
        // ship in later commits. Render a visible TODO so it surfaces if
        // a card is ordered before its widget exists.
        <p className="text-xs text-[var(--color-brand-red)]">
          Widget not yet implemented: {card.input.type}
        </p>
      )}
    </div>
  )
}

// ─── single-select widget ──────────────────────────────────────────────

interface SingleSelectFieldProps {
  options: Array<{ value: string; labelKey: string; descriptionKey?: string }>
  value: string
  onChange: (next: string) => void
}

function SingleSelectField({ options, value, onChange }: SingleSelectFieldProps) {
  const t = useT()
  return (
    <div
      role="radiogroup"
      className="grid gap-3"
    >
      {options.map((opt) => {
        const selected = value === opt.value
        const label = readI18n(t, opt.labelKey)
        const description = opt.descriptionKey ? readI18n(t, opt.descriptionKey) : null
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'text-start rounded-2xl border px-4 py-3 transition-colors',
              'bg-[var(--color-brand-card)]',
              selected
                ? 'border-[var(--color-brand-red)] ring-2 ring-[var(--color-brand-red)]/20'
                : 'border-[var(--color-brand-border)] hover:border-[var(--color-brand-text-muted)]',
            )}
          >
            <div className="text-sm font-medium text-[var(--color-brand-text-primary)]">
              {label}
            </div>
            {description ? (
              <div className="mt-1 text-xs text-[var(--color-brand-text-secondary)] leading-relaxed">
                {description}
              </div>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
