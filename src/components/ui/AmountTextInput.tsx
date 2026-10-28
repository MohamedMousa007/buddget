'use client'

import type { ComponentProps } from 'react'
import { sanitizeAmount, type AmountSanitizeMode } from '@/lib/ui/amountSanitize'

interface AmountTextInputProps
  extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'inputMode' | 'size'> {
  value: string
  onChange: (next: string) => void
  mode?: AmountSanitizeMode
  /** Sets how many decimals may be typed (3 for KWD, 8 for BTC). */
  currency?: string
}

/** Web-only amount entry: a real input with a sanitised value. Native uses the NumberPad instead. */
export function AmountTextInput({ value, onChange, mode = 'decimal', currency, onFocus, ...props }: AmountTextInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode={mode === 'decimal' ? 'decimal' : 'numeric'}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      value={value}
      maxLength={mode === 'pin' ? 4 : undefined}
      onChange={(e) => onChange(sanitizeAmount(e.target.value, mode, currency))}
      onFocus={(e) => {
        e.currentTarget.select()
        onFocus?.(e)
      }}
    />
  )
}
