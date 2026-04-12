import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import type { Currency } from '@/lib/store/types'

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
  const formatted = showCents
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  if (['$', '€', '£'].includes(symbol)) {
    return `${symbol}${formatted}`
  }
  return `${symbol} ${formatted}`
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
