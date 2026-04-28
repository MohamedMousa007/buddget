'use client'

import { useMemo, useState } from 'react'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import { PROFILE_COUNTRY_OPTIONS, type ProfileCountryOption } from '@/lib/profile/countryOptions'
import { defaultCurrencyForCountry } from '@/lib/profile/countryToCurrency'
import type { Currency } from '@/lib/store/types'

const COMMON_CODES = ['AE', 'EG', 'SA', 'IN', 'PK', 'GB', 'US', 'PH'] as const

function orderedCountryOptions(query: string): ProfileCountryOption[] {
  const q = query.trim().toLowerCase()
  const commonSet = new Set<string>(COMMON_CODES)
  const commonOrdered = COMMON_CODES.map((code) =>
    PROFILE_COUNTRY_OPTIONS.find((o) => o.code === code),
  ).filter(Boolean) as ProfileCountryOption[]

  if (!q) {
    const rest = PROFILE_COUNTRY_OPTIONS.filter((o) => !commonSet.has(o.code))
    return [...commonOrdered, ...rest]
  }

  const filtered = PROFILE_COUNTRY_OPTIONS.filter((o) => o.nameEn.toLowerCase().includes(q))
  const commonHit = commonOrdered.filter((o) => o.nameEn.toLowerCase().includes(q))
  const rest = filtered
    .filter((o) => !commonSet.has(o.code))
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'))
  return [...commonHit, ...rest]
}

export function StepLocation({ draft, updateDraft }: OnboardingStepProps) {
  const [query, setQuery] = useState('')

  const displayHint = useMemo(() => {
    const c = draft.country.trim()
    if (!c) return null
    const cur: Currency | undefined = defaultCurrencyForCountry(c, '')
    return cur ?? draft.baseCurrency
  }, [draft.baseCurrency, draft.country])

  const rows = useMemo(() => orderedCountryOptions(query), [query])

  function pick(option: ProfileCountryOption) {
    const cur = defaultCurrencyForCountry(option.nameEn, '') ?? draft.baseCurrency
    updateDraft({ country: option.nameEn, baseCurrency: cur })
    setQuery('')
  }

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-3 flex-1 min-h-0">
      <label htmlFor="country-search" className="sr-only">
        Search country
      </label>
      <input
        id="country-search"
        type="search"
        autoComplete="off"
        placeholder="Search country…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl bg-[#111118] border border-[#2A2A38] text-white placeholder:text-[#5A5A72] px-4 py-3 outline-none focus:border-[#E50914]"
      />

      {draft.country ? (
        <p className="text-sm text-[#A0A0B8]">
          Selected: <span className="text-white">{draft.country}</span>
        </p>
      ) : null}

      {draft.country && displayHint ? (
        <p className="text-sm text-[#A0A0B8]">
          We&apos;ll use <span className="text-white">{displayHint}</span> as your main currency.
        </p>
      ) : null}

      <ul
        role="listbox"
        aria-label="Countries"
        className="max-h-60 overflow-y-auto rounded-xl border border-[#2A2A38] bg-[#111118] divide-y divide-[#2A2A38]"
      >
        {rows.map((o) => (
          <li key={o.code} role="none">
            <button
              type="button"
              role="option"
              aria-selected={draft.country === o.nameEn}
              onClick={() => pick(o)}
              className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[#1A1A24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E50914]"
            >
              {o.nameEn}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
