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
  onNameChange: (name: string) => void
  onNext: () => void
}

/**
 * Step 1 — display name, country picker, and optional inline currency override.
 */
export function StepIdentity({
  state,
  onCountrySelect,
  onCurrencySelect,
  onToggleCurrencyOverride,
  onNameChange,
  onNext,
}: StepIdentityProps) {
  const t = useT()
  const [countrySearch, setCountrySearch] = useState('')

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

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.onboarding.nameLabel}
        </label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => onNameChange(e.target.value.slice(0, 50))}
          placeholder={t.onboarding.namePlaceholder}
          className="w-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-red)]/50"
        />
      </div>

      {/* Country */}
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

        {/* Inline currency tag */}
        {selectedCountry && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-[var(--color-brand-text-muted)]">
              {t.onboarding.currencyDetected(state.currency)}
            </span>
            <button
              type="button"
              onClick={onToggleCurrencyOverride}
              className="flex items-center gap-0.5 text-xs text-[var(--color-brand-red)] hover:underline"
            >
              {t.onboarding.currencyChange}
              <ChevronDown className={`w-3 h-3 transition-transform ${state.currencyOverrideOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </div>
        )}

        {state.currencyOverrideOpen && (
          <div className="grid grid-cols-4 gap-2 mt-1">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCurrencySelect(c)}
                className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${state.currency === c ? 'bg-[var(--color-brand-red)] border-[var(--color-brand-red)] text-white' : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

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
