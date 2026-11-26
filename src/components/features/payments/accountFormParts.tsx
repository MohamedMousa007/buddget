'use client'

import type { ReactNode } from 'react'
import { toLatinDigits } from '@/lib/utils/formatters'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { OptionChip } from '@/components/ui/OptionChip'
import { useT } from '@/lib/i18n'
import { microClassName } from '@/lib/ui/microLabelStyle'

/** Trigger styling for the shared `CurrencyField` inside the account and card sheets, so both pick a currency the same way. */
export const ACCOUNT_CURRENCY_FIELD_CLASS =
  'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm'

export type Identifier = 'last4' | 'label' | 'none'

interface AccountIdentifierFieldProps {
  mode: Identifier
  onModeChange: (m: Identifier) => void
  /** Whether this kind of account or card takes four digits at all. */
  allowsLast4: boolean
  last4: string
  onLast4Change: (v: string) => void
  label: string
  onLabelChange: (v: string) => void
}

/**
 * How an account is told apart on screen: the last four digits, a label of the user's own, or nothing. Shared by the
 * Add account and Add card sheets so both ask the same way. Choosing Label never discards the digits already stored:
 * SMS matching still needs them.
 * Built from OptionChip (size segment) and Input (brand), as the card sheet's identifier block was.
 */
export function AccountIdentifierField({ mode, onModeChange, allowsLast4, last4, onLast4Change, label, onLabelChange }: AccountIdentifierFieldProps) {
  const t = useT().paymentMethods
  const modes: Identifier[] = allowsLast4 ? ['last4', 'label', 'none'] : ['label', 'none']
  const names: Record<Identifier, string> = { last4: t.fourDigits, label: t.label, none: t.none }
  return (
    <div>
      <div className="mx-0.5 mb-2 flex items-center gap-2">
        <span className={microClassName}>{t.identifier}</span>
        <span className="text-[0.625rem] font-medium text-[var(--color-brand-text-muted)]">{t.optional}</span>
      </div>
      <div className="flex gap-2">
        {modes.map((m) => (
          <OptionChip key={m} size="segment" selected={mode === m} onClick={() => onModeChange(m)}>{names[m]}</OptionChip>
        ))}
      </div>
      {mode === 'last4' ? (
        <>
          <Last4Tiles
            value={last4}
            onChange={onLast4Change}
            label={t.fourDigits}
            className="mt-2.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]"
          />
          <div className="mt-2 px-0.5 text-[0.71875rem] text-[var(--color-brand-text-muted)]">{t.last4Help}</div>
        </>
      ) : null}
      {mode === 'label' ? (
        <>
          <Input
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            maxLength={24} placeholder={t.tagPlaceholder} aria-label={t.label}
            size="brand" className="mt-2.5 text-[0.9375rem] text-[var(--color-brand-text-primary)] text-start"
          />
          {last4 ? <div className="mt-2 px-0.5 text-[0.71875rem] text-[var(--color-brand-text-muted)]">{t.labelKeepsDigits}</div> : null}
        </>
      ) : null}
    </div>
  )
}

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
