'use client'

import { Input } from '@/components/ui/input'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { readI18n } from '@/components/features/onboarding/journey/cards/InfoCard'
import type { FieldCard as FieldCardModel } from '@/lib/onboarding/journeyTypes'
import type { Currency } from '@/lib/store/types'

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
      ) : card.input.type === 'text' ? (
        <TextField
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          placeholderKey={card.input.placeholderKey}
          maxLength={card.input.maxLength}
        />
      ) : card.input.type === 'country' ? (
        <CountryField value={typeof value === 'string' ? value : ''} onChange={onChange} />
      ) : card.input.type === 'currency' ? (
        <CurrencyField value={typeof value === 'string' ? value : 'USD'} onChange={onChange} />
      ) : card.input.type === 'yes-no' ? (
        <YesNoField value={typeof value === 'string' ? value : ''} onChange={onChange} />
      ) : null}
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

// ─── text widget ────────────────────────────────────────────────────────

function TextField({
  value,
  onChange,
  placeholderKey,
  maxLength,
}: {
  value: string
  onChange: (next: string) => void
  placeholderKey?: string
  maxLength?: number
}) {
  const t = useT()
  const placeholder = placeholderKey ? readI18n(t, placeholderKey) : ''
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus
      className="h-12 text-base"
    />
  )
}

// ─── country widget ─────────────────────────────────────────────────────

function CountryField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useT()
  const { locale } = useLocale()
  return (
    <CountrySelect
      value={value}
      onChange={onChange}
      locale={locale}
      placeholder={t.profile.labelCountry ?? 'Country'}
    />
  )
}

// ─── currency widget ────────────────────────────────────────────────────

function CurrencyField({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <FiatCurrencySelect
      value={value as Currency}
      onChange={(next) => onChange(next)}
    />
  )
}

// ─── yes/no widget ──────────────────────────────────────────────────────

function YesNoField({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const t = useT()
  const options: Array<{ value: 'yes' | 'no'; label: string }> = [
    { value: 'yes', label: t.common.yes ?? 'Yes' },
    { value: 'no', label: t.common.no ?? 'No' },
  ]
  return (
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
              'rounded-2xl border px-4 py-3 text-sm font-medium transition-colors text-center',
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
  )
}
