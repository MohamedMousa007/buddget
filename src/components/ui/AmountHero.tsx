'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { AmountTextInput } from '@/components/ui/AmountTextInput'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { useNumberPad } from '@/components/ui/useNumberPad'
import { useIsNativeClient } from '@/lib/native/useIsNativeClient'
import { useT } from '@/lib/i18n'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { cn } from '@/lib/utils'
import { HIT_AREA } from '@/lib/ui/hitArea'
import { groupAmountText } from '@/lib/ui/amountSanitize'
import type { Currency } from '@/lib/store/types'

const UNIT_CLASS = 'font-mono-numbers text-[1.625rem] font-semibold leading-none tracking-[-0.03em] text-[var(--color-brand-text-muted)]'

export interface AmountHeroProps {
  value: string
  onChange: (next: string) => void
  /** ISO code: sets the typed decimals and, unless `unit` is given, the unit text. Omit for a plain count. */
  currency?: string
  /** Picking a new currency from the built-in CurrencySheet. Without it (and `onUnitClick`) the unit is static. */
  onCurrencyChange?: (code: string) => void
  /** A unit that is not a currency (grams, karat): its text, opened by `onUnitClick`. */
  unit?: ReactNode
  /** Replaces the CurrencySheet, for a unit picker of the caller's own. */
  onUnitClick?: () => void
  /** What the unit is, for its accessible name ("Currency", "Unit"). */
  unitKind?: 'currency' | 'unit'
  /** CurrencySheet options. */
  base?: Currency
  includeGold?: boolean
  codes?: readonly string[]
  /** Shown before the digits, e.g. "+" for money in. */
  sign?: ReactNode
  /** Above the amount: an icon tile, a logo. */
  top?: ReactNode
  /** Small caption above the amount. */
  label?: ReactNode
  /** One line under the amount (a conversion, what changes); pass '' to keep its height while empty. */
  line?: ReactNode
  mode?: 'decimal' | 'integer'
  /** Shows the amount as plain text: no input, no pad, the unit not tappable (a system-linked amount). Default off. */
  readOnly?: boolean
  id?: string
  'aria-label'?: string
  className?: string
}

/**
 * The big amount at the top of a money sheet, with its unit inline after the digits (a muted currency code, grams or
 * karat) that opens a picker when tapped. Web types into an input; native opens the NumberPad, like AmountField.
 */
export function AmountHero({
  value, onChange, currency = '', onCurrencyChange, unit, onUnitClick, unitKind = 'currency', base, includeGold, codes,
  sign, top, label, line, mode = 'decimal', readOnly = false, id, 'aria-label': ariaLabel, className,
}: AmountHeroProps) {
  const t = useT()
  const c = useLightTouchCopy().amountHero
  const native = useIsNativeClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const name = ariaLabel ?? t.common.amountLabel
  const { isOpen, openPad, pad } = useNumberPad({ value, onChange, mode, currency: currency || undefined, label: name, dir: 'ltr' })
  const unitText = unit ?? currency
  const openUnit = readOnly ? undefined : onUnitClick ?? (onCurrencyChange ? () => setSheetOpen(true) : undefined)
  // The digits are shown grouped ("50,000") while `value` stays canonical.
  const shown = groupAmountText(value)
  const digits = 'font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--color-brand-text-primary)]'

  return (
    <div className={cn('flex flex-col items-center px-5 pb-4 pt-2 text-center', className)}>
      {top}
      {label ? <p className="mt-3 text-[0.8125rem] font-medium text-[var(--color-brand-text-secondary)]">{label}</p> : null}
      <div dir="ltr" className={cn('flex items-baseline justify-center gap-1.5', top || label ? 'mt-2' : 'mt-1')}>
        {readOnly ? (
          <span id={id} className={cn('flex items-baseline', digits)}>
            {sign}
            <span>{shown || '0'}</span>
          </span>
        ) : native ? (
          <button
            id={id}
            type="button"
            onClick={openPad}
            aria-label={value ? `${name}: ${value}` : name}
            className={cn('flex items-baseline', digits)}
          >
            {sign}
            <span className={cn(!value && 'text-[var(--color-brand-text-muted)]', isOpen && 'underline decoration-[var(--color-brand-primary)] decoration-2 underline-offset-8')}>
              {shown || '0'}
            </span>
          </button>
        ) : (
          <label className={cn('flex items-baseline', digits)}>
            {sign}
            {/* An invisible copy of the digits sizes the box, so the unit sits right after the number. */}
            <span className="relative inline-block">
              <span aria-hidden className="invisible whitespace-pre">{shown || '0'}</span>
              <AmountTextInput
                id={id}
                aria-label={name}
                value={value}
                onChange={onChange}
                mode={mode}
                grouped
                currency={currency || undefined}
                placeholder="0"
                className={cn('absolute inset-0 w-full min-w-0 bg-transparent outline-none placeholder:text-[var(--color-brand-text-muted)]', sign ? 'text-left' : 'text-center')}
              />
            </span>
          </label>
        )}
        {openUnit ? (
          <button
            type="button"
            onClick={openUnit}
            aria-label={c[unitKind](typeof unitText === 'string' ? unitText : currency)}
            className={cn(HIT_AREA, 'inline-flex items-center gap-0.5 hover:text-[var(--color-brand-text-secondary)]', UNIT_CLASS)}
          >
            <span dir="auto">{unitText}</span>
            <ChevronDown className="size-[18px] translate-y-px" aria-hidden />
          </button>
        ) : unitText ? (
          <span dir="auto" className={UNIT_CLASS}>{unitText}</span>
        ) : null}
      </div>
      {line !== undefined ? <p className="mt-2 min-h-5 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{line}</p> : null}
      {native && !readOnly ? pad : null}
      {onCurrencyChange && !onUnitClick && !readOnly ? (
        <CurrencySheet
          open={sheetOpen}
          value={currency}
          base={base}
          includeGold={includeGold}
          codes={codes}
          onSelect={(code) => { onCurrencyChange(code); setSheetOpen(false) }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </div>
  )
}
