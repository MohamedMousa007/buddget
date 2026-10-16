export type AmountSanitizeMode = 'decimal' | 'integer' | 'pin'

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹'
const MAX_DIGITS = 12
const MAX_DECIMALS = 2
const PIN_LENGTH = 4

/** Normalises typed/pasted text into a canonical amount string (latin digits, one '.'). */
export function sanitizeAmount(raw: string, mode: AmountSanitizeMode = 'decimal'): string {
  const latin = raw
    .replace(/[٠-٩]/g, (c) => String(ARABIC_INDIC.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(EXT_ARABIC_INDIC.indexOf(c)))
    .replace(/[,٫]/g, '.')

  if (mode === 'pin') return latin.replace(/\D/g, '').slice(0, PIN_LENGTH)
  if (mode === 'integer') return latin.replace(/\D/g, '').slice(0, MAX_DIGITS)

  const cleaned = latin.replace(/[^0-9.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned.slice(0, MAX_DIGITS)
  const int = cleaned.slice(0, dot).slice(0, MAX_DIGITS)
  const dec = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, MAX_DECIMALS)
  return `${int}.${dec}`
}
