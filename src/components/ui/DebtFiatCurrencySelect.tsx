'use client'

import { useEffect, useMemo } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  buildDebtFiatPickerOptions,
  clampDebtFiatToAllowed,
} from '@/lib/utils/currencyPickerOptions'
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

  useEffect(() => {
    const next = clampDebtFiatToAllowed(settings, value)
    if (next === value) return
    onChange(next)
  }, [settings, value, onChange])

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as DebtCurrency)}
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
