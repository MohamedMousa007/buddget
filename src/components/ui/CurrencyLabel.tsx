'use client'

import { cn } from '@/lib/utils'
import { AedSymbol } from '@/components/ui/icons/AedSymbol'
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
 * Currency-aware value renderer. Behaves like the `formatMoneyHero` string
 * helper for every currency whose symbol has mature font support, and upgrades
 * to an inline SVG glyph for AED (the Central Bank's 2025 dirham mark, which
 * doesn't ship in OS fonts yet). Use this anywhere the plain-text formatter
 * falls short — the dashboard hero, stat tiles, summary cards, etc.
 *
 * Any other currency keeps the plain-string path for now; add further SVGs
 * here when the need arises.
 */
export function CurrencyLabel({
  amount,
  currency,
  className,
  compact = 'auto',
  fullMaxChars = 8,
}: CurrencyLabelProps) {
  if (currency === 'AED') {
    // Reuse the same compact decision the text formatter makes, but slice
    // out just the numeric portion so the SVG can stand in for the "Dh".
    const text = formatMoneyHero(amount, 'AED', { compact, fullMaxChars })
    const numericPart = text.replace(/^Dh\s?/, '').trim()
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <AedSymbol className="w-[0.9em] h-[0.9em] shrink-0" />
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
