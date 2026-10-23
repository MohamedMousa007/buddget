'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { COUNTRIES, OTHER_CURRENCIES, type CountryCode } from '@/lib/onboarding/steps'
import type { Currency } from '@/lib/store/types'
import { BuddgyHead, stepTitle } from './BuddgyHead'
import type { StepChrome } from './chrome'
import { JourneyFrame } from './JourneyFrame'
import { useOnboardingCopy } from './useOnboardingCopy'

const DEFAULT_NAMES = new Set(['', 'user', 'local'])

function countryOf(currency: Currency): CountryCode | 'OTHER' {
  return (Object.keys(COUNTRIES) as CountryCode[]).find((k) => COUNTRIES[k].currency === currency) ?? 'OTHER'
}

/** Step 1: a name to be called by, where you live, language. Currency follows the country. */
export function StepAbout({ chrome }: { chrome: StepChrome }) {
  const c = useOnboardingCopy()
  const profile = useFinanceStore((s) => s.profile)
  const settings = useFinanceStore((s) => s.settings)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const [name, setName] = useState(DEFAULT_NAMES.has((profile.name ?? '').trim().toLowerCase()) ? '' : (profile.name ?? ''))
  const [country, setCountry] = useState<CountryCode | 'OTHER'>(countryOf(settings.baseCurrency))
  const [other, setOther] = useState<Currency>(settings.baseCurrency)

  const currency: Currency = country === 'OTHER' ? other : COUNTRIES[country].currency
  const canGo = name.trim().length > 0

  const save = () => {
    updateProfile({ name: name.trim(), ...(country === 'OTHER' ? {} : { country }) })
    updateSettings({ baseCurrency: currency })
    chrome.next()
  }

  return (
    <JourneyFrame
      {...chrome}
      footer={
        <Button size="cta" className="w-full" disabled={!canGo} onClick={save}>
          {c.cont}
        </Button>
      }
    >
      <div className="flex items-center gap-3">
        <BuddgyHead mood="happy" />
        <span className="rounded-full bg-[var(--color-brand-primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-brand-primary-ink)]">{c.about.badge}</span>
      </div>
      <h1 className={`${stepTitle} mt-[18px]`}>{c.about.title}</h1>

      <div className="mt-6 flex flex-col gap-[18px]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.about.nameLabel}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={c.about.namePlaceholder} autoComplete="given-name" maxLength={40} />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.about.countryLabel}</span>
          <div className="flex flex-wrap gap-2">
            {([...(Object.keys(COUNTRIES) as CountryCode[]), 'OTHER'] as const).map((k) => (
              <OptionChip key={k} as="trigger" size="md" selected={country === k} onClick={() => setCountry(k)}>
                {c.about.countries[k]}
              </OptionChip>
            ))}
          </div>
          {country === 'OTHER' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {OTHER_CURRENCIES.map((cur) => (
                <OptionChip key={cur} as="trigger" size="md" selected={other === cur} onClick={() => setOther(cur)}>
                  {cur}
                </OptionChip>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.about.languageLabel}</span>
          <SegmentedControl
            ariaLabel={c.about.languageLabel}
            value={settings.language === 'ar' ? 'ar' : 'en'}
            onChange={(v) => updateSettings({ language: v })}
            options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]}
          />
        </div>

        <p className="px-1 text-[15px] text-[var(--color-brand-text-secondary)]">
          {c.about.currencyLine(currency, country === 'OTHER' ? currency : COUNTRIES[country].name)}
        </p>
      </div>

      <p className="mt-3.5 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--color-brand-text-muted)]">
        <Info className="mt-px size-4 shrink-0" aria-hidden />
        {c.about.why}
      </p>
    </JourneyFrame>
  )
}
