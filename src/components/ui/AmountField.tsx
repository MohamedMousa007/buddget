'use client'

/**
 * AmountField — trigger for the glass NumberPad. Renders the current value as a
 * <button> (never a focusable <input>, which would summon the OS keyboard this
 * pad replaces) and opens the pad on tap. Drop-in for money fields (mode
 * "decimal") and card last-4 (mode "pin").
 *
 * Pass `className` to inherit a form's control styling — it merges over the same
 * base classes the shared <Input> uses, so the field matches its siblings. Omit
 * className for the standalone glass style from the handoff.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CurrencyMark } from '@/components/ui/CurrencyMark'
import { useIsNativeClient } from '@/lib/native/useIsNativeClient'
import { AmountTextInput } from '@/components/ui/AmountTextInput'
import { useNumberPad } from '@/components/ui/useNumberPad'
import type { NumberPadMode } from '@/components/ui/NumberPad'

interface AmountFieldProps {
  value: string
  onChange: (next: string) => void
  mode?: NumberPadMode
  currency?: string
  placeholder?: string
  label?: string
  dir?: 'ltr' | 'rtl'
  /** Inherit a form's control classes (merged over the <Input> base). */
  className?: string
  /** Use className verbatim without the <Input> base — for borderless inputs
   *  living inside their own bordered wrapper (filters, inline table cells). */
  bare?: boolean
  disabled?: boolean
  /** Glass style only: compact is 44px / 20px value for fields sharing a row. */
  size?: 'default' | 'compact'
  id?: string
  'aria-label'?: string
}

// Mirrors the shared <Input> base so call-site classNames layer on identically.
const BASE =
  'h-8 w-full min-w-0 flex items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-start md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55'

export function AmountField({
  value,
  onChange,
  mode = 'decimal',
  currency,
  placeholder,
  label,
  dir = 'ltr',
  className,
  bare,
  disabled,
  size = 'default',
  id,
  'aria-label': ariaLabel,
}: AmountFieldProps) {
  const native = useIsNativeClient()
  const [focused, setFocused] = useState(false)
  const { isOpen, openPad, pad } = useNumberPad({ value, onChange, mode, currency, label, dir })
  const ph = placeholder ?? (mode === 'pin' ? '0000' : '0.00')
  const showPrefix = mode === 'decimal' && !!currency
  const glass = !className
  const compactSize = size === 'compact'

  const unit = (
    <span
      style={
        glass
          ? { marginInlineStart: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: compactSize ? 14 : 16, color: 'var(--color-brand-text-muted)' }
          : { opacity: 0.6 }
      }
    >
      {currency ? <CurrencyMark code={currency} /> : null}
    </span>
  )

  // Sits inside the value's own span, so it follows the last digit whatever the field's layout does.
  const caret = isOpen ? (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 2,
        height: '1.05em',
        marginInlineStart: 1,
        borderRadius: 2,
        verticalAlign: '-0.15em',
        background: 'var(--color-brand-primary)',
        animation: 'npBlink 1.06s steps(1) infinite',
      }}
    />
  ) : null

  if (!native) {
    const active = focused
    return (
      <div
        dir={dir}
        className={glass ? undefined : bare ? className : cn(BASE, 'focus-within:ring-2 focus-within:ring-[var(--color-brand-focus)]/55', className)}
        style={
          glass
            ? {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                height: compactSize ? 44 : 52,
                background: 'var(--color-brand-elevated)',
                border: `1px solid ${active ? 'var(--color-brand-focus)' : 'var(--color-brand-border)'}`,
                borderRadius: compactSize ? 12 : 14,
                padding: '0 14px',
                transition: 'border-color .15s',
              }
            : { borderColor: active ? 'var(--color-brand-focus)' : undefined }
        }
      >
        {showPrefix && !glass && unit}
        <AmountTextInput
          id={id}
          aria-label={ariaLabel ?? label}
          disabled={disabled}
          value={value}
          onChange={onChange}
          mode={mode}
          placeholder={ph}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          dir={dir}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-start outline-none placeholder:opacity-50"
          style={
            glass
              ? {
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: compactSize ? 20 : 24,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-brand-text-primary)',
                }
              : { font: 'inherit', color: 'inherit' }
          }
        />
        {showPrefix && glass && unit}
      </div>
    )
  }

  return (
    <>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={openPad}
        className={glass ? undefined : bare ? className : cn(BASE, className)}
        dir={dir}
        style={
          glass
            ? {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                height: compactSize ? 44 : 52,
                background: 'var(--color-brand-elevated)',
                border: `1px solid ${isOpen ? 'var(--color-brand-focus)' : 'var(--color-brand-border)'}`,
                borderRadius: compactSize ? 12 : 14,
                padding: '0 14px',
                cursor: 'pointer',
                transition: 'border-color .15s',
              }
            : { cursor: 'pointer', borderColor: isOpen ? 'var(--color-brand-focus)' : undefined }
        }
      >
        {showPrefix && !glass && unit}
        <span
          style={
            glass
              ? {
                  flex: '0 1 auto',
                  minWidth: 0,
                  textAlign: 'start',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: compactSize ? 20 : 24,
                  letterSpacing: '-0.02em',
                  color: value ? 'var(--color-brand-text-primary)' : 'var(--color-brand-text-muted)',
                  opacity: value ? 1 : 0.55,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }
              : { flex: '0 1 auto', minWidth: 0, textAlign: 'start', opacity: value ? 1 : 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
          }
        >
          {value ? <>{value}{caret}</> : <>{caret}{ph}</>}
        </span>
        {showPrefix && glass && unit}
      </button>
      {pad}
    </>
  )
}
