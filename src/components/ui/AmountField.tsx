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

import { cn } from '@/lib/utils'
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
  id,
  'aria-label': ariaLabel,
}: AmountFieldProps) {
  const { isOpen, openPad, pad } = useNumberPad({ value, onChange, mode, currency, label, dir })
  const ph = placeholder ?? (mode === 'pin' ? '0000' : '0.00')
  const showPrefix = mode === 'decimal' && !!currency
  const glass = !className

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
                height: 52,
                background: '#16161f',
                border: `1px solid ${isOpen ? 'var(--color-brand-focus)' : '#26262f'}`,
                borderRadius: 14,
                padding: '0 14px',
                cursor: 'pointer',
                transition: 'border-color .15s',
              }
            : { cursor: 'pointer', borderColor: isOpen ? 'var(--color-brand-focus)' : undefined }
        }
      >
        {showPrefix && (
          <span
            style={
              glass
                ? { fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18, color: '#5A5A72' }
                : { opacity: 0.6 }
            }
          >
            {currency}
          </span>
        )}
        <span
          style={
            glass
              ? {
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'start',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: 24,
                  letterSpacing: '-0.02em',
                  color: value ? '#fff' : '#3F3F4D',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }
              : { flex: 1, minWidth: 0, textAlign: 'start', opacity: value ? 1 : 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
          }
        >
          {value || ph}
        </span>
        <span
          style={{
            width: 2,
            height: 26,
            borderRadius: 2,
            background: 'var(--color-brand-red)',
            display: isOpen ? 'block' : 'none',
            animation: 'npBlink 1.1s steps(1) infinite',
          }}
        />
      </button>
      {pad}
    </>
  )
}
