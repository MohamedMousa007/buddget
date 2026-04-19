'use client'

import { useMemo } from 'react'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import {
  PROFILE_COUNTRY_OPTIONS,
  countryNameEnFromCode,
  resolveProfileCountryToCode,
} from '@/lib/profile/countryOptions'

export type CountrySelectProps = {
  /** Stored value: English country name (or legacy alpha-2 code). */
  value: string
  onChange: (countryNameEn: string) => void
  /** BCP 47 locale for option labels (e.g. from `useLocale()`). */
  locale: string
  placeholder: string
  id?: string
  className?: string
}

/**
 * Themed country picker backed by the app's `SelectField` primitive. Persists
 * English display names for API/onboarding compatibility; the trigger + list
 * are localised via `Intl.DisplayNames`. Search is auto-enabled (list size).
 */
export function CountrySelect({
  value,
  onChange,
  locale,
  placeholder,
  id,
  className,
}: CountrySelectProps) {
  const displayNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: 'region' }),
    [locale],
  )

  const items = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      PROFILE_COUNTRY_OPTIONS.map((o) => ({
        value: o.code,
        label: displayNames.of(o.code) ?? o.nameEn,
      })),
    [displayNames],
  )

  const selectedCode = resolveProfileCountryToCode(value)

  return (
    <SelectField
      id={id}
      value={selectedCode}
      onChange={(code) => {
        const nameEn = countryNameEnFromCode(code)
        if (nameEn) onChange(nameEn)
      }}
      items={items}
      placeholder={placeholder}
      aria-label={placeholder}
      className={className}
    />
  )
}
