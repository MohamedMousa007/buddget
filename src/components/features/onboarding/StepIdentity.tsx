'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/store/types'
import type { OnboardingState } from '@/hooks/useOnboarding'
import { ONBOARDING_COUNTRIES } from '@/hooks/useOnboarding'

const CURRENCIES: Currency[] = [
  'AED', 'EGP', 'SAR', 'JOD', 'KWD', 'QAR', 'BHD', 'OMR', 'MAD', 'TND',
  'USD', 'EUR', 'GBP',
]

interface StepIdentityProps {
  state: OnboardingState
  onCountrySelect: (code: string) => void
  onCurrencySelect: (c: Currency) => void
  onToggleCurrencyOverride: () => void
  onSecondaryCurrencySelect: (c: Currency | '') => void
  onNameChange: (name: string) => void
  onNext: () => void
}

/**
 * Step 1 — display name, country picker, primary currency override,
 * and optional secondary currency selector.
 */
export function StepIdentity({
  state,
  onCountrySelect,
  onCurrencySelect,
  onToggleCurrencyOverride,
  onSecondaryCurrencySelect,
  onNameChange,
  onNext,
}: StepIdentityProps) {
  const t = useT()
  const [countrySearch, setCountrySearch] = useState('')
  const [secondaryOpen, setSecondaryOpen] = useState(false)

  const filtered = countrySearch
    ? ONBOARDING_COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()),
      )
    : ONBOARDING_COUNTRIES
  const selectedCountry = ONBOARDING_COUNTRIES.find((c) => c.code === state.country)
  const canContinue = state.name.trim().length > 0 && !!state.country

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-brand-text-primary)]">
          {t.onboarding.welcomeTitle}
        </h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
          {t.onboarding.welcomeSubtitle}
        </p>
      </div>

      <NameField value={state.name} onChange={onNameChange} t={t} />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.onboarding.countryLabel}
        </label>
        <div className="relative">
          <input
            type="text"
            value={selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : countrySearch}
            onChange={(e) => { setCountrySearch(e.target.value); if (state.country) onCountrySelect('') }}
            placeholder={t.onboarding.countryLabel}
            className="w-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-red)]/50"
          />
          {countrySearch && !state.country && (
            <ul className="absolute z-10 mt-1 w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filtered.slice(0, 20).map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => { onCountrySelect(c.code); setCountrySearch('') }}
                    className="w-full text-start px-4 py-2.5 text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                  >
                    {c.flag} {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedCountry && (
          <div className="flex items-center justify-between gap-3 mt-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 rounded-lg bg-[var(--color-brand-red)]/10 px-2.5 py-1 text-sm font-bold text-[var(--color-brand-red)]">
                {state.currency}
              </span>
              <span className="text-xs text-[var(--color-brand-text-muted)] truncate">
                {t.onboarding.currencyDetected(state.currency)}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleCurrencyOverride}
              className="flex shrink-0 items-center gap-1 min-h-[44px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 text-xs font-semibold text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50 transition-colors"
            >
              {t.onboarding.currencyChange}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${state.currencyOverrideOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </div>
        )}

        {state.currencyOverrideOpen && (
          <CurrencyGrid
            currencies={CURRENCIES}
            selected={state.currency}
            onSelect={onCurrencySelect}
          />
        )}
      </div>

      {selectedCountry && (
        <SecondaryCurrencySection
          open={secondaryOpen}
          onToggle={() => setSecondaryOpen((v) => !v)}
          selected={state.secondaryCurrency}
          primary={state.currency}
          onSelect={(c) => { onSecondaryCurrencySelect(c); if (c) setSecondaryOpen(false) }}
          t={t}
        />
      )}

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full py-3.5 rounded-xl font-medium text-sm transition-colors bg-[var(--color-brand-red)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {t.onboarding.continueButton}
        <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden />
      </button>
    </div>
  )
}

function NameField({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: ReturnType<typeof useT> }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.onboarding.nameLabel}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 50))}
        placeholder={t.onboarding.namePlaceholder}
        className="w-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-red)]/50"
      />
    </div>
  )
}

function CurrencyGrid({
  currencies,
  selected,
  onSelect,
  exclude,
}: {
  currencies: Currency[]
  selected: Currency | ''
  onSelect: (c: Currency) => void
  exclude?: Currency | ''
}) {
  return (
    <div className="grid grid-cols-4 gap-2 mt-1">
      {currencies
        .filter((c) => c !== exclude)
        .map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            className={`min-h-[44px] rounded-lg text-xs font-medium border transition-colors ${selected === c ? 'bg-[var(--color-brand-red)] border-[var(--color-brand-red)] text-white' : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50'}`}
          >
            {c}
          </button>
        ))}
    </div>
  )
}

function SecondaryCurrencySection({
  open,
  onToggle,
  selected,
  primary,
  onSelect,
  t,
}: {
  open: boolean
  onToggle: () => void
  selected: Currency | ''
  primary: Currency
  onSelect: (c: Currency | '') => void
  t: ReturnType<typeof useT>
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">
          {t.onboarding.secondaryCurrencyTitle}
        </p>
        <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5 leading-relaxed">
          {t.onboarding.secondaryCurrencyHint}
        </p>
      </div>

      {selected ? (
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-lg bg-[var(--color-brand-red)]/10 px-2.5 py-1 text-sm font-bold text-[var(--color-brand-red)]">
            {selected}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="min-h-[44px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 text-xs font-semibold text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50 transition-colors"
            >
              {t.onboarding.currencyChange}
            </button>
            <button
              type="button"
              onClick={() => onSelect('')}
              className="min-h-[44px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 text-xs font-semibold text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)] hover:border-[var(--color-brand-red)]/50 transition-colors"
            >
              {t.onboarding.secondaryCurrencyRemove}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 text-sm font-semibold text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50 transition-colors"
        >
          {t.onboarding.addSecondaryCurrency}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}

      {open && (
        <CurrencyGrid
          currencies={CURRENCIES}
          selected={selected}
          onSelect={onSelect}
          exclude={primary}
        />
      )}
    </div>
  )
}
