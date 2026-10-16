'use client'

import type { ComponentProps } from 'react'
import { sanitizeAmount, type AmountSanitizeMode } from '@/lib/ui/amountSanitize'

interface AmountTextInputProps
  extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'inputMode' | 'size'> {
  value: string
  onChange: (next: string) => void
  mode?: AmountSanitizeMode
}

/** Web-only amount entry: a real input with a sanitised value. Native uses the NumberPad instead. */
export function AmountTextInput({ value, onChange, mode = 'decimal', onFocus, ...props }: AmountTextInputProps) {
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
      onChange={(e) => onChange(sanitizeAmount(e.target.value, mode))}
      onFocus={(e) => {
        e.currentTarget.select()
        onFocus?.(e)
      }}
    />
  )
}
