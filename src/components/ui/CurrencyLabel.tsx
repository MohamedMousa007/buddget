'use client'

import { cn } from '@/lib/utils'
import { AedSymbol } from '@/components/ui/icons/AedSymbol'
import { EgpSymbol } from '@/components/ui/icons/EgpSymbol'
import { SarSymbol } from '@/components/ui/icons/SarSymbol'
import { formatMoneyHero } from '@/lib/utils/formatters'
import type { Currency } from '@/lib/store/types'

export interface CurrencyLabelProps {
  amount: number
  currency: Currency | string
  className?: string
  /** Compact-notation policy — same contract as `formatMoneyHero`. */
  compact?: 'auto' | 'on' | 'off'
  fullMaxChars?: number
}

/**
 * Currency-aware value renderer. For currencies whose official marks aren't
 * ubiquitously available in OS fonts yet (AED's 2025 mark, SAR's 2020 mark,
 * EGP's A3 Jeem design) we render an inline SVG using `currentColor` so the
 * glyph inherits whatever text colour surrounds it. All other currencies
 * keep the plain-string path via `formatMoneyHero` (uses ASCII / Unicode
 * symbols from `CURRENCY_SYMBOLS`).
 *
 * Use this anywhere the UI shows a monetary value — dashboard heroes, stat
 * tiles, transaction rows, summary cards. Emails / CSV exports should stick
 * with `formatCurrency` (pure string).
 */
export function CurrencyLabel({
  amount,
  currency,
  className,
  compact = 'auto',
  fullMaxChars = 8,
}: CurrencyLabelProps) {
  const svgCurrency = SVG_CURRENCIES[currency]
  if (svgCurrency) {
    const text = formatMoneyHero(amount, currency, { compact, fullMaxChars })
    // Strip the text-fallback prefix so the SVG stands in for the symbol.
    const numericPart = text.replace(svgCurrency.prefixRegex, '').trim()
    const Icon = svgCurrency.Icon
    return (
      <span className={cn('inline-flex items-baseline gap-1', className)}>
        <Icon className="w-[0.9em] h-[0.9em] shrink-0" />
        <span>{numericPart}</span>
      </span>
    )
  }
  return (
    <span className={className}>
      {formatMoneyHero(amount, currency, { compact, fullMaxChars })}
    </span>
  )
}

/**
 * Registry of currencies we render as SVG. The `prefixRegex` strips the
 * text-fallback that `formatMoneyHero` would otherwise prepend so the SVG
 * cleanly stands in for the symbol.
 */
const SVG_CURRENCIES: Record<
  string,
  { Icon: (props: { className?: string }) => React.ReactElement; prefixRegex: RegExp }
> = {
  AED: { Icon: AedSymbol, prefixRegex: /^Dh\s?/ },
  EGP: { Icon: EgpSymbol, prefixRegex: /^E£\s?/ },
  SAR: { Icon: SarSymbol, prefixRegex: /^⃀\s?|^SR\s?/ },
}
