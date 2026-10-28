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
