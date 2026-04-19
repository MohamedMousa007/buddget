'use client'

import { useEffect, useMemo } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  buildFiatCurrencyPickerOptions,
  clampFiatToAllowed,
} from '@/lib/utils/currencyPickerOptions'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
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

  const items = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      options.map((o) => ({
        value: o.value,
        label: o.value,
        disabled: o.disabled,
      })),
    [options],
  )

  useEffect(() => {
    const next = clampFiatToAllowed(settings, value)
    if (next === value) return
    onChange(next)
  }, [settings, value, onChange])

  return (
    <SelectField
      id={id}
      value={value}
      onChange={(next) => onChange(next as Currency)}
      items={items}
      className={className}
    />
  )
}
