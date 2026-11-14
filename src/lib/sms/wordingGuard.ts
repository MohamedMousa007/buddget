/**
 * Wording guard. A learned template can keep matching after a bank changes its wording, or match a reversal, decline or
 * future-dated notice that shares the shape of a real payment. The sample a template was learned from shows which of
 * these words belong to its format; a message that carries one the sample did not is suspect.
 *
 * Count only for now: the verdict is recorded on the log row, never acted on (docs/launch/S2b2-second-review.md 3.7).
 */
import { normalizeSmsText } from '@/lib/sms/normalizeDigits'

const GUARD_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['declined', /\bdeclined\b/i],
  ['reversed', /\brevers(?:ed|al)\b/i],
  ['refund', /\brefund(?:ed|s)?\b/i],
  ['rejected', /\brejected\b/i],
  ['will be', /\bwill\s+be\b/i],
  ['due', /\bdue\b/i],
  ['مرفوض', /(?<![\u0600-\u06FF])[وف]?مرفوض/],
  ['رفض', /(?<![\u0600-\u06FF])[وف]?رفض/],
  ['عكس', /(?<![\u0600-\u06FF])[وف]?عكس/],
  ['استرجاع', /(?<![\u0600-\u06FF])[وف]?استرجاع/],
  ['سيتم', /(?<![\u0600-\u06FF])[وف]?سيتم/],
]

export const GUARD_WORDS: readonly string[] = GUARD_PATTERNS.map(([word]) => word)

/**
 * Enforce only after the hit count has been read from real traffic: a template with no recorded guard words (every one
 * that exists today) counts every guard word as a hit, so the first reading over-counts on purpose.
 * Enforcing means diverting to the next tier, never rejecting the message.
 */
export const WORDING_GUARD_ENFORCED: boolean = false

/** The guard words the text contains, in list order. */
export function guardWordsIn(text: string): string[] {
  const normalised = normalizeSmsText(text)
  return GUARD_PATTERNS.filter(([, re]) => re.test(normalised)).map(([word]) => word)
}

/** The guard words stored on a template's mapping rules; anything that is not a list of strings counts as none. */
export function storedGuardWords(rules: { guardWords?: unknown } | null | undefined): string[] {
  const g = rules?.guardWords
  return Array.isArray(g) ? g.filter((w): w is string => typeof w === 'string') : []
}

/** True when the message carries a guard word the template's own sample did not. */
export function wordingGuardDiverts(templateGuardWords: readonly string[], messageText: string): boolean {
  return guardWordsIn(messageText).some((w) => !templateGuardWords.includes(w))
}
