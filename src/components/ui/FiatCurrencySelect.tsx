'use client'

import { useEffect, useMemo } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  buildFiatCurrencyPickerOptions,
  clampFiatToAllowed,
} from '@/lib/utils/currencyPickerOptions'
import type { Currency } from '@/lib/store/types'

type Props = {
  value: Currency
  onChange: (c: Currency) => void
  className?: string
  id?: string
}

export function FiatCurrencySelect({ value, onChange, className, id }: Props) {
  const settings = useFinanceStore((s) => s.settings)
  const options = useMemo(() => buildFiatCurrencyPickerOptions(settings), [settings])

  useEffect(() => {
    const next = clampFiatToAllowed(settings, value)
    if (next === value) return
    onChange(next)
  }, [settings, value, onChange])

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as Currency)}
      className={className}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.value}
        </option>
      ))}
    </select>
  )
}
