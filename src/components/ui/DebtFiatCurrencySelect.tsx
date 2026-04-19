'use client'

import { useEffect, useMemo } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  buildDebtFiatPickerOptions,
  clampDebtFiatToAllowed,
} from '@/lib/utils/currencyPickerOptions'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { DebtCurrency } from '@/lib/store/types'

type Props = {
  value: DebtCurrency
  onChange: (c: DebtCurrency) => void
  className?: string
  id?: string
}

export function DebtFiatCurrencySelect({ value, onChange, className, id }: Props) {
  const settings = useFinanceStore((s) => s.settings)
  const options = useMemo(() => buildDebtFiatPickerOptions(settings), [settings])

  const items = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => options.map((o) => ({ value: o.value, label: o.value, disabled: o.disabled })),
    [options],
  )

  useEffect(() => {
    const next = clampDebtFiatToAllowed(settings, value)
    if (next === value) return
    onChange(next)
  }, [settings, value, onChange])

  return (
    <SelectField
      id={id}
      value={value}
      onChange={(next) => onChange(next as DebtCurrency)}
      items={items}
      className={className}
    />
  )
}
