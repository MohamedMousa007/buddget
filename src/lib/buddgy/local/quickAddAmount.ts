const AMOUNT_RE = /(\d+(?:[.,]\d+)*)(?:(k|m)(?![\p{L}\d])|\s*(million|مليون|[أإآا]لف)(?![\p{L}\d]))?/giu

function parseNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token)
  const commas = token.split(',').length - 1
  const dots = token.split('.').length - 1
  if (commas && dots) {
    const [whole, frac] = token.split('.')
    if (dots > 1 || !/^[1-9]\d{0,2}(,\d{3})+$/.test(whole)) return null
    return Number(`${whole.replace(/,/g, '')}.${frac}`)
  }
  if (dots) {
    const [, frac] = token.split('.')
    return dots === 1 && frac.length <= 2 ? Number(token) : null
  }
  const parts = token.split(',')
  if (parts.length === 2 && parts[1].length <= 2) return Number(`${parts[0]}.${parts[1]}`)
  if (/^[1-9]\d{0,2}$/.test(parts[0]) && parts.slice(1).every((p) => p.length === 3)) {
    return Number(parts.join(''))
  }
  return null
}

function multiplier(short: string | undefined, word: string | undefined): number {
  if (short) return short.toLowerCase() === 'k' ? 1e3 : 1e6
  if (!word) return 1
  return /^(million|مليون)$/i.test(word) ? 1e6 : 1e3
}

/** Exactly one money-like number, or null. */
export function extractAmount(text: string): { amount: number; rest: string } | null {
  const matches = [...text.matchAll(AMOUNT_RE)]
  if (matches.length !== 1) return null
  const [whole, digits, short, word] = matches[0]
  const value = parseNumber(digits)
  if (value === null) return null
  const amount = Math.round(value * multiplier(short, word) * 100) / 100
  if (!(amount > 0)) return null
  const at = matches[0].index
  return { amount, rest: `${text.slice(0, at)} ${text.slice(at + whole.length)}` }
}
