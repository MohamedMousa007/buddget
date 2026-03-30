'use client'

import { useMemo } from 'react'
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
 * Native full-width country picker; persists English display names for API/onboarding compatibility.
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
    [locale]
  )
  const selectedCode = resolveProfileCountryToCode(value)

  return (
    <select
      id={id}
      value={selectedCode}
      onChange={(e) => {
        const code = e.target.value
        if (!code) {
          onChange('')
          return
        }
        const nameEn = countryNameEnFromCode(code)
        if (nameEn) onChange(nameEn)
      }}
      className={className}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {PROFILE_COUNTRY_OPTIONS.map((o) => (
        <option key={o.code} value={o.code}>
          {displayNames.of(o.code) ?? o.nameEn}
        </option>
      ))}
    </select>
  )
}
