import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import type { Currency } from '@/lib/store/types'

/**
 * Numeric formatting always uses `en-US` so digits render as 0-9 and separators as `,` / `.`
 * in every UI language. Arabic month/weekday *names* still come from the active locale —
 * see `useLocalizedFormatters` and `toLatinDigits` for date strings.
 */
function numberLocale(): string {
  return 'en-US'
}

/**
 * Replace Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits with Western 0-9.
 * Use on date strings formatted with an Arabic locale to keep the names (e.g. "أبريل")
 * but render numbers in Latin digits.
 */
export function toLatinDigits(input: string): string {
  return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.charCodeAt(0)
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660
    return String(code - base)
  })
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  AED: 'AED',
  USD: '$',
  EGP: 'EGP',
  EUR: '€',
  GBP: '£',
  SAR: 'SAR',
  XAU: 'g',
  USDT: 'USDT',
  USDC: 'USDC',
  BTC: 'BTC',
  ETH: 'ETH',
}

export function formatCurrency(amount: number, currency: Currency | string, showCents = true): string {
  if (currency === 'XAU') {
    return `${amount.toFixed(2)}g`
  }

  const symbol = CURRENCY_SYMBOLS[currency] || currency
  const loc = numberLocale()
  const formatted = showCents
    ? amount.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount.toLocaleString(loc, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  if (['$', '€', '£'].includes(symbol)) {
    return `${symbol}${formatted}`
  }
  return `${symbol} ${formatted}`
}

/**
 * Currency-attached formatter for dense hero / card surfaces. Emits `"$1,234"`
 * or `"AED 1.2M"` depending on width. Use for per-column stats where the full
 * number sometimes doesn't fit a 3-col mobile grid — pass `compact: 'auto'`
 * to let the helper decide, or `'on'` / `'off'` to force.
 */
export function formatMoneyHero(
  amount: number,
  currency: Currency | string,
  options: { compact?: 'auto' | 'on' | 'off'; fullMaxChars?: number } = {},
): string {
  const { compact = 'auto', fullMaxChars = 9 } = options
  if (currency === 'XAU') return `${amount.toFixed(2)}g`

  const symbol = CURRENCY_SYMBOLS[currency] || currency
  const loc = numberLocale()
  const rounded = Math.round(amount)

  const fullNumber = rounded.toLocaleString(loc, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  const compactNumber = new Intl.NumberFormat(loc, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(rounded)

  const stick = ['$', '€', '£'].includes(symbol)
  const join = (n: string) => (stick ? `${symbol}${n}` : `${symbol} ${n}`)
  const full = join(fullNumber)

  if (compact === 'off') return full
  if (compact === 'on') return join(compactNumber)
  return full.length > fullMaxChars ? join(compactNumber) : full
}

/**
 * English-only relative labels. For UI that follows the app language, use `useLocalizedFormatters` from `@/hooks/useLocalizedFormatters`.
 */
export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'd MMM yyyy')
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMM')
}

export function formatRelativeTime(dateStr: string): string {
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
}

export function formatMonth(dateStr: string): string {
  return format(parseISO(dateStr + '-01'), 'MMMM yyyy')
}

export function formatMonthShort(dateStr: string): string {
  return format(parseISO(dateStr + '-01'), 'MMM yyyy')
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function groupByDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, d MMMM')
}

export function escapeCsvField(value: unknown): string {
  const stringValue = String(value ?? '')
  const escaped = stringValue.replace(/"/g, '""')
  return `"${escaped}"`
}
