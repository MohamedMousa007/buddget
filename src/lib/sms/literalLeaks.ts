import { scanForLeaks } from '@/lib/sms/maskPii'

/** Wording a template legitimately holds as a literal: Title-Case phrases, a static URL, a printed example amount. */
const LITERAL_NOISE = new Set<string>(['name_title', 'url_path', 'amount'])

/** Regex syntax that is not a literal: character classes, escapes, group/quantifier punctuation. */
function literalText(regexPattern: string): string {
  return regexPattern
    .replace(/\[(?:\\.|[^\]\\])*\]/g, ' ')
    .replace(/\\[dDwWsSbB]/g, ' ')
    .replace(/\\(.)/g, '$1')
    .replace(/\(\?[:=!<]+/g, ' ')
    .replace(/[()|*+?{}^$]|\{\d+(?:,\d*)?\}/g, ' ')
}

/**
 * Per-user literals inside a learned regex (N14): an account/phone/reference number, a person's name,
 * or the very amount or card digits of the sample message. A template that embeds one matches only
 * that user's next SMS and publishes their detail to every other user. Returns the finding kinds
 * (never the literal), empty when the regex is clean.
 */
export function perUserLiteralKinds(
  regexPattern: string,
  known: { amount?: number | null; last4?: string | null } = {},
): string[] {
  const lit = literalText(regexPattern)
  const kinds = new Set<string>(scanForLeaks(lit, { weakArabicCues: false }).filter((f) => !LITERAL_NOISE.has(f.kind)).map((f) => f.kind))
  const digitRuns: string[] = lit.match(/\d+/g) ?? []
  if (known.last4 && digitRuns.includes(known.last4)) kinds.add('last4_literal')
  if (known.amount != null) {
    const a = known.amount
    const forms = new Set([a.toFixed(2), String(a), a.toLocaleString('en-US', { minimumFractionDigits: 2 })])
    if ([...forms].some((f) => f.length >= 3 && lit.includes(f))) kinds.add('amount_literal')
  }
  return [...kinds]
}
