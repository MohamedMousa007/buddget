'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { CurrencySign, hasCurrencySign } from '@/components/ui/CurrencyMark'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { CURRENCY_META } from '@/lib/constants/currencyMeta'
import { cn } from '@/lib/utils'
import type { Currency, DebtCurrency } from '@/lib/store/types'

type Props = {
  value: string
  onChange: (c: never) => void
  className?: string
  id?: string
  /** Include gold (XAU) — for debt currency pickers. */
  includeGold?: boolean
  /** Restrict the list to these codes (e.g. the rate-converter's supported set). */
  codes?: readonly string[]
  /** 44px / ~96px trigger: symbol + code only (name hidden). */
  compact?: boolean
  /** Stacking for the picker when the field sits inside a sheet that is itself stacked. Default `z-[110]`. */
  zIndexClassName?: string
  /** Shows the value but does not open the picker. */
  disabled?: boolean
}

/**
 * Drop-in currency selector (replaces FiatCurrencySelect / DebtFiatCurrencySelect).
 * A field-style trigger that opens the unified {@link CurrencySheet}.
 */
export function CurrencyField({ value, onChange, className, id, includeGold = false, codes, compact = false, zIndexClassName, disabled = false }: Props) {
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const [open, setOpen] = useState(false)
  const meta = CURRENCY_META[value]

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between gap-2 text-start',
          disabled && 'opacity-60',
          compact && 'h-11 min-h-11 w-auto min-w-[88px] px-3',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {hasCurrencySign(value) ? (
            <CurrencySign code={value} className="font-mono-numbers text-sm font-semibold leading-none text-[var(--color-brand-text-muted)]" />
          ) : null}
          <span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">
            {value}
          </span>
          {!compact && meta?.name && (
            <span className="truncate text-xs text-[var(--color-brand-text-muted)]">
              {meta.name}
            </span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
      </button>
      <CurrencySheet
        open={open}
        value={value}
        base={base}
        includeGold={includeGold}
        codes={codes}
        zIndexClassName={zIndexClassName}
        onSelect={(code) => {
          onChange(code as never)
          setOpen(false)
        }}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

/** Typed wrappers so existing call sites keep their exact prop types. */
export function FiatCurrencyField(props: {
  value: Currency
  onChange: (c: Currency) => void
  className?: string
  id?: string
  /** Hide the full name in the trigger (narrow contexts like the income sheets). */
  compact?: boolean
  disabled?: boolean
}) {
  return <CurrencyField {...props} />
}

export function DebtCurrencyField(props: {
  value: DebtCurrency
  onChange: (c: DebtCurrency) => void
  className?: string
  id?: string
}) {
  return <CurrencyField {...props} includeGold />
}
