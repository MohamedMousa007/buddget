import { canonicalAmount, currencyDecimals, toLatin } from '@/lib/ui/amountParse'

export type AmountSanitizeMode = 'decimal' | 'integer' | 'pin'

const MAX_DIGITS = 12
const PIN_LENGTH = 4

/** Normalises typed/pasted text into a canonical amount string (latin digits, one '.'). */
export function sanitizeAmount(raw: string, mode: AmountSanitizeMode = 'decimal', currency?: string): string {
  if (mode === 'decimal') return canonicalAmount(raw, currencyDecimals(currency))
  const digits = toLatin(raw).replace(/\D/g, '')
  return digits.slice(0, mode === 'pin' ? PIN_LENGTH : MAX_DIGITS)
}

/** Canonical amount text ("2000.5") with its integer part grouped for display ("2,000.5"); a trailing "." or "0.50" stays as typed. */
export function groupAmountText(canonical: string): string {
  if (!canonical) return ''
  const [int, dec] = canonical.split('.')
  const grouped = (int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${grouped}.${dec}` : grouped
}

/**
 * {@link sanitizeAmount} for a field that shows its value grouped: the commas it displays are thousands marks, so they
 * are dropped before the text is read ("2,0005" is 20005, not 2.0005). Only "." (or the Arabic "٫") is a decimal mark.
 */
export function sanitizeGroupedAmount(raw: string, mode: AmountSanitizeMode = 'decimal', currency?: string): string {
  return sanitizeAmount(toLatin(raw).replace(/,/g, ''), mode, currency)
}

/** How many characters of a typed amount count toward the caret (digits in any script and the decimal mark, not commas). */
export function amountCharsBefore(raw: string, caret: number): number {
  return (raw.slice(0, caret).match(/[0-9٠-٩۰-۹.٫]/g) ?? []).length
}

/** The caret index in grouped `shown` text that sits after `count` digits or decimal marks. */
export function caretInGrouped(shown: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < shown.length; i++) {
    if (shown[i] !== ',') seen++
    if (seen === count) return i + 1
  }
  return shown.length
}
