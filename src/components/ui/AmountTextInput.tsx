'use client'

import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import {
  amountCharsBefore, caretInGrouped, groupAmountText, sanitizeAmount, sanitizeGroupedAmount, type AmountSanitizeMode,
} from '@/lib/ui/amountSanitize'

interface AmountTextInputProps
  extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'inputMode' | 'size'> {
  value: string
  onChange: (next: string) => void
  mode?: AmountSanitizeMode
  /** Sets how many decimals may be typed (3 for KWD, 8 for BTC). */
  currency?: string
  /** Shows thousands separators while typing ("2,000"); `value` and `onChange` stay canonical ("2000"). Default off. */
  grouped?: boolean
}

/** Web-only amount entry: a real input with a sanitised value. Native uses the NumberPad instead. */
export function AmountTextInput({ value, onChange, mode = 'decimal', currency, grouped = false, onFocus, onKeyDown, ...props }: AmountTextInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const shown = grouped && mode !== 'pin' ? groupAmountText(value) : value

  // A separator added or dropped by grouping would throw the caret to the end: put it back after the same digit.
  useLayoutEffect(() => {
    const el = ref.current
    if (caret.current === null || !el) return
    const at = caretInGrouped(shown, caret.current)
    caret.current = null
    if (document.activeElement === el) el.setSelectionRange(at, at)
  })

  return (
    <input
      {...props}
      ref={grouped ? ref : props.ref}
      type="text"
      inputMode={mode === 'decimal' ? 'decimal' : 'numeric'}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      value={shown}
      maxLength={mode === 'pin' ? 4 : undefined}
      onChange={(e) => {
        if (!grouped) return onChange(sanitizeAmount(e.target.value, mode, currency))
        const next = sanitizeGroupedAmount(e.target.value, mode, currency)
        if (next !== value) caret.current = amountCharsBefore(e.target.value, e.target.selectionStart ?? e.target.value.length)
        onChange(next)
      }}
      onKeyDown={(e) => {
        // Backspace right after a separator deletes the digit before it, not the separator (which grouping would put back).
        const el = e.currentTarget
        const at = el.selectionStart
        if (grouped && e.key === 'Backspace' && at && at === el.selectionEnd && el.value[at - 1] === ',') el.setSelectionRange(at - 1, at - 1)
        onKeyDown?.(e)
      }}
      onFocus={(e) => {
        e.currentTarget.select()
        onFocus?.(e)
      }}
    />
  )
}
