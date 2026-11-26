'use client'

import type { ReactNode } from 'react'
import { toLatinDigits } from '@/lib/utils/formatters'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { OptionChip } from '@/components/ui/OptionChip'
import { AmountField } from '@/components/ui/AmountField'
import { useT } from '@/lib/i18n'
import { microClassName } from '@/lib/ui/microLabelStyle'

/** Trigger styling for the shared `CurrencyField` inside the account and card sheets, so both pick a currency the same way. */
export const ACCOUNT_CURRENCY_FIELD_CLASS =
  'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm'

/**
 * The last four digits as four small tiles on one 52px row, typed through one hidden input (digits only, Arabic-Indic
 * converted). A stored tail longer than four (banks print up to six) shows all its digits and is never cut.
 */
export function Last4Tiles({ value, onChange, label, optional = false, className }: {
  value: string
  onChange: (digits: string) => void
  /** The row's label; defaults to "Last 4 digits". */
  label?: ReactNode
  /** Appends "· optional" to the label. */
  optional?: boolean
  className?: string
}) {
  const c = useLightTouchCopy().last4
  const size = Math.max(4, value.length)
  return (
    <label className={cn('relative flex min-h-[52px] items-center gap-3 px-4', className)}>
      <span className="min-w-0 flex-1 text-[0.84375rem] text-[var(--color-brand-text-secondary)]">
        {label ?? c.label}
        {optional ? <span className="text-[var(--color-brand-text-muted)]"> · {c.optional}</span> : null}
      </span>
      <span aria-hidden dir="ltr" className="flex gap-1.5">
        {Array.from({ length: size }, (_, i) => (
          <span
            key={i}
            className={cn(
              'flex h-9 w-8 items-center justify-center rounded-lg border-[1.5px] bg-[var(--color-brand-elevated)] font-mono-numbers text-base font-semibold text-[var(--color-brand-text-primary)]',
              i === value.length ? 'border-[var(--color-brand-primary)]' : 'border-[var(--color-brand-border)]',
            )}
          >
            {value[i] ?? ''}
          </span>
        ))}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, size))}
        dir="ltr"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={size}
        autoComplete="off"
        aria-label={typeof label === 'string' ? label : c.label}
        className="absolute inset-0 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
      />
    </label>
  )
}

/**
 * A typed field as one 52px row of a grouped list (Light touch): the field name, then the input at the end. The
 * placeholder carries what an empty field means ("CIB ••1234" for a Name, "30,000" for a limit).
 */
export function InputRow({ label, value, onChange, placeholder, amountCurrency, maxLength = 40 }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** An amount in this currency: the app's AmountField (the NumberPad on native, the currency's decimals) instead of text. */
  amountCurrency?: string
  maxLength?: number
}) {
  const field = 'min-w-0 flex-1 bg-transparent text-end text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)] outline-none placeholder:font-normal placeholder:text-[var(--color-brand-text-muted)]'
  return (
    <label className="flex min-h-[52px] items-center gap-3 px-4">
      <span className="w-[112px] shrink-0 text-[0.84375rem] text-[var(--color-brand-text-secondary)]">{label}</span>
      {amountCurrency !== undefined ? (
        <AmountField bare look="row" grouped value={value} onChange={onChange} decimalsFor={amountCurrency} placeholder={placeholder} aria-label={label}
          className={cn(field, 'flex justify-end font-mono-numbers rtl:justify-start')} />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          className={field}
        />
      )}
    </label>
  )
}

/**
 * The other numbers bank messages use for this account (its account number, a linked card). Shown so a wrong link can
 * be undone: each one can be removed. Built from OptionChip (size sm) with an X, like the rest of the form.
 */
export function AccountAliasChips({ aliases, onRemove }: { aliases: readonly string[]; onRemove: (digits: string) => void }) {
  const t = useT().paymentMethods
  if (aliases.length === 0) return null
  return (
    <div>
      <div className={`mx-0.5 mb-2 ${microClassName}`}>{t.alsoRecognised}</div>
      <div className="flex flex-wrap gap-2">
        {aliases.map((digits) => (
          <OptionChip key={digits} size="sm" selected={false} onClick={() => onRemove(digits)} aria-label={t.removeNumber(digits)}>
            <span className="font-mono-numbers">••{digits}</span>
            <X className="size-3.5" aria-hidden />
          </OptionChip>
        ))}
      </div>
    </div>
  )
}
