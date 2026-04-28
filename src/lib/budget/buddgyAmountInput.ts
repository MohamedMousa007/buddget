/**
 * Plan-builder amount fields: digits and at most one decimal point; no negatives.
 */
export function sanitizeBuddgyAmountTyping(raw: string): string {
  const noMinus = raw.replace(/-/g, '')
  let out = ''
  let seenDot = false
  for (const ch of noMinus) {
    if (ch >= '0' && ch <= '9') out += ch
    else if ((ch === '.' || ch === ',') && !seenDot) {
      seenDot = true
      out += '.'
    }
  }
  return out
}

export function parseBuddgyAmountInput(s: string): number {
  const t = s.trim().replace(/,/g, '')
  if (t === '' || t === '.') return 0
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/** After blur: empty field displays as "0". */
export function buddgyAmountBlurDisplay(s: string): string {
  const t = s.trim()
  if (t === '' || t === '.') return '0'
  const n = parseBuddgyAmountInput(t)
  return String(n)
}
