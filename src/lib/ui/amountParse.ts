/**
 * The one amount parser. Typed, pasted, AI-read and SMS-read strings all go through here.
 * Rules: Arabic-Indic digits and separators are normalised; with both '.' and ',' present
 * the LAST one is the decimal mark. A lone ',' followed by exactly three digits is a
 * thousands mark ("1,250" = 1250) for 0/2-decimal or unknown currencies, and a decimal mark
 * for 3-decimal and crypto currencies ("1,250" KWD = 1.25). A lone '.' is always a decimal
 * mark. A separator repeated without clean 3-digit groups ("1.5.5", "1,25,3") is invalid:
 * typing keeps the text before the second one, parsing returns NaN. Exponents ("1e3") are
 * invalid. A sign is not part of the magnitude (callers that allow negatives read it themselves).
 * Parsing rounds to the currency's decimals; typing caps them.
 */

/** ISO 4217 minor unit of 3. */
export const THREE_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set(['KWD', 'BHD', 'OMR', 'JOD', 'TND'])
const EIGHT_DECIMAL = new Set(['BTC', 'ETH'])
const MAX_INT_DIGITS = 12
const DEFAULT_DECIMALS = 2
const EIGHT_DECIMAL_CAP = 8

/** Minor-unit digits a currency accepts when typing or reading an amount. */
export function currencyDecimals(currency?: string): number {
  if (!currency) return DEFAULT_DECIMALS
  const c = currency.toUpperCase()
  if (THREE_DECIMAL_CURRENCIES.has(c)) return 3
  if (EIGHT_DECIMAL.has(c)) return 8
  if (c === 'XAU') return 3
  return DEFAULT_DECIMALS
}

export function toLatin(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٬   \s'’]/g, '')
    .replace(/٫/g, '.')
    .replace(/[،٬]/g, ',')
}

type Analysis = { text: string; valid: boolean }

function analyse(raw: string, cap: number, commaThousands: boolean): Analysis {
  const latin = toLatin(raw)
  if (/\d[eE][+-]?\d/.test(latin)) return { text: '', valid: false }
  const s = latin.replace(/[^0-9.,]/g, '')
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  const last = Math.max(lastDot, lastComma)
  if (last === -1) return { text: s.slice(0, MAX_INT_DIGITS), valid: true }

  const sepChar = s[last]
  const otherKind = sepChar === '.' ? lastComma : lastDot
  const sepCount = s.split(sepChar).length - 1

  if (sepCount > 1) {
    const groups = s.split(sepChar).slice(1)
    const grouped = otherKind === -1 && groups.every((g) => g.length === 3) && s.split(sepChar)[0] !== ''
    if (!grouped) {
      const cut = s.indexOf(sepChar, s.indexOf(sepChar) + 1)
      return { text: analyse(s.slice(0, cut), cap, commaThousands).text, valid: false }
    }
    return { text: s.replace(/[.,]/g, '').slice(0, MAX_INT_DIGITS), valid: true }
  }

  const before = s.slice(0, last)
  const after = s.slice(last + 1)
  if (/[.,]/.test(before) || /[.,]/.test(after)) {
    const beforeKind = sepChar === '.' ? ',' : '.'
    const beforeOk = !before.includes(sepChar) && before.split(beforeKind).slice(1).every((g) => g.length === 3)
    const afterOk = !/[.,]/.test(after)
    if (!(beforeOk && afterOk)) return { text: analyse(s.slice(0, last), cap, commaThousands).text, valid: false }
    return { text: `${before.replace(/[.,]/g, '').slice(0, MAX_INT_DIGITS)}.${after.slice(0, cap)}`, valid: true }
  }
  if (otherKind === -1 && sepChar === ',' && commaThousands && after.length === 3 && before !== '' && before !== '0') {
    return { text: `${before}${after}`.slice(0, MAX_INT_DIGITS), valid: true }
  }
  return { text: `${before.slice(0, MAX_INT_DIGITS)}.${after.slice(0, cap)}`, valid: true }
}

/**
 * Canonical amount text for a field being typed into: latin digits, at most one '.', decimals
 * capped at maxDecimals (a lone ',' is thousands only when maxDecimals <= 2).
 * A trailing '.' is kept so "5." stays "5.".
 */
export function canonicalAmount(raw: string, maxDecimals = DEFAULT_DECIMALS): string {
  return analyse(raw, maxDecimals, maxDecimals <= DEFAULT_DECIMALS).text
}

/** Parses a complete amount string, rounding to the currency's decimals; NaN when empty or invalid. */
export function parseLocalizedAmount(raw: string, currency?: string): number {
  const decimals = currencyDecimals(currency)
  const { text, valid } = analyse(raw, EIGHT_DECIMAL_CAP, decimals <= DEFAULT_DECIMALS)
  if (!valid || !/\d/.test(text)) return Number.NaN
  const n = Number(text)
  const f = 10 ** decimals
  return Math.round(Number((n * f).toPrecision(15))) / f
}
