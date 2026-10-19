'use client'

import { AedSymbol } from '@/components/ui/icons/AedSymbol'
import { SarSymbol } from '@/components/ui/icons/SarSymbol'
import { CURRENCY_META } from '@/lib/constants/currencyMeta'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** True when the currency has a real sign (a glyph or SVG), not just its own three letters. */
export function hasCurrencySign(code: string): boolean {
  if (code === 'AED' || code === 'SAR') return true
  const symbol = CURRENCY_META[code]?.symbol
  return Boolean(symbol) && symbol !== code
}

/**
 * The currency's sign alone: AED and SAR draw their official marks; every other supported currency shows the
 * abbreviation its central bank uses (KD, QR, BD, RO, DH, DT, JD), or the Arabic-script form in Arabic.
 */
export function CurrencySign({ code, className }: { code: string; className?: string }) {
  const { locale } = useLocale()
  if (code === 'AED') return <AedSymbol className={cn('h-[1em] w-[1em]', className)} />
  if (code === 'SAR') return <SarSymbol className={cn('h-[1em] w-[1em]', className)} />
  const meta = CURRENCY_META[code]
  const symbol = locale === 'ar' ? (meta?.symbolAr ?? meta?.symbol) : meta?.symbol
  return symbol && symbol !== code ? <span className={className}>{symbol}</span> : null
}

/** The sign when there is one, otherwise the three letters: never both, so a code is never shown twice. */
export function CurrencyMark({ code, className }: { code: string; className?: string }) {
  return hasCurrencySign(code) ? <CurrencySign code={code} className={className} /> : <span className={className}>{code}</span>
}
