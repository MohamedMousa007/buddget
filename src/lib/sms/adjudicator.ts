/**
 * AI adjudication of user signals.
 *
 * A user editing or deleting an SMS-created transaction is ambiguous. They may be telling us
 * the parse was wrong — or they may have deleted a duplicate they had already logged, decided
 * not to track it, or simply preferred different wording. Counting all of those against the
 * template would fill the signal set with preference noise and retire templates that work.
 *
 * So a raw signal is never evidence on its own. Once a template accumulates enough of them, the
 * SMS body, what the template extracted and what the user changed it to go to the AI with one
 * question: reading this message, was the extraction objectively wrong, or did the user just
 * want something different? Only "wrong" counts — and when it is wrong, the same call returns
 * the CORRECT extraction, which becomes the exemplar that stops the mistake recurring.
 *
 * One mechanism, both jobs: it decides *whether* the template failed and *what the right answer
 * was*.
 */

export type AdjudicationVerdict =
  /** The extraction is objectively wrong — counts against the template, and carries a fix. */
  | 'parse_error'
  /** The regex matched something that is not a transaction at all — over-broad. */
  | 'not_transaction'
  /** The user wanted it different; the parse was right. Never counts. */
  | 'user_preference'
  /** Already recorded elsewhere — a dedupe problem, not a regex problem. Never counts. */
  | 'duplicate'
  /** Not determinable from the message. Never counts; surfaced for a human. */
  | 'unclear'

export interface AdjudicationInput {
  /** The raw SMS the template parsed. */
  body: string
  /** What the template extracted. */
  extracted: {
    amount: number | null
    currency: string | null
    kind: string | null
    last4: string | null
    date: string | null
  }
  /** What the user changed, one entry per signal. */
  changes: Array<{
    signalKind: 'objective_edit' | 'delete' | 'reported'
    field?: string | null
    from?: string | null
    to?: string | null
  }>
}

export interface AdjudicationResult {
  verdict: AdjudicationVerdict
  confidence: number
  /** Present only for `parse_error` — the values the SMS actually supports. */
  corrected?: {
    amount?: number | null
    currency?: string | null
    kind?: string | null
    last4?: string | null
    date?: string | null
  }
  reason?: string
}

/** Verdicts that count against a template. The rest are explicitly free. */
const COUNTS_AGAINST = new Set<AdjudicationVerdict>(['parse_error', 'not_transaction'])

export function verdictCountsAgainstTemplate(v: AdjudicationVerdict): boolean {
  return COUNTS_AGAINST.has(v)
}

export const ADJUDICATOR_PROMPT = `You are auditing an automated bank-SMS parser.

A user edited or deleted a transaction that was created automatically from the SMS below. Decide
whether the PARSER was wrong, or whether the user simply wanted something different.

Read the SMS yourself and determine what it objectively says. The amount, currency, direction
and account are facts printed in the message — they are not matters of opinion. Category,
merchant wording and notes ARE matters of opinion.

Return ONLY this JSON object (no markdown, no commentary):
{
  "verdict": "parse_error" | "not_transaction" | "user_preference" | "duplicate" | "unclear",
  "confidence": number,
  "corrected": { "amount": number|null, "currency": string|null, "kind": string|null, "last4": string|null, "date": string|null } | null,
  "reason": string
}

Verdicts:
- "parse_error": the SMS plainly says something different from what was extracted (wrong amount,
  wrong currency, wrong direction, wrong account). Set "corrected" to what the SMS actually says.
  A very common case: the parser captured the account BALANCE instead of the transaction amount.
- "not_transaction": the SMS is not a financial transaction at all (an OTP, a marketing message,
  a balance notification), so nothing should have been created.
- "user_preference": the extraction matches the SMS, and the user changed it to suit themselves
  (recategorised it, renamed the merchant, reassigned which card it came from, adjusted the date
  for their own bookkeeping). The parser was RIGHT.
- "duplicate": the transaction is real and correctly parsed, but the user had already recorded it
  another way, so they removed one copy. The parser was RIGHT.
- "unclear": the SMS does not let you decide. Prefer this over guessing.

Rules:
- Judge ONLY against what the SMS says. If the extraction matches the SMS, it is never a
  parse_error, no matter what the user changed it to.
- A deletion on its own is weak evidence. If the extraction matches the SMS, a deletion is
  "user_preference" or "duplicate", not "parse_error".
- "corrected" must be null unless the verdict is "parse_error".
- "confidence" reflects how certain you are, 0 to 1.`

export function buildAdjudicationPrompt(input: AdjudicationInput): string {
  const changes = input.changes
    .map((c) =>
      c.signalKind === 'delete'
        ? '- the user DELETED the transaction'
        : c.signalKind === 'reported'
          ? '- the user explicitly reported this as wrong'
          : `- the user changed ${c.field} from ${JSON.stringify(c.from)} to ${JSON.stringify(c.to)}`,
    )
    .join('\n')

  return `SMS:
${JSON.stringify(input.body)}

The parser extracted:
${JSON.stringify(input.extracted, null, 2)}

What the user did:
${changes}`
}

/**
 * Normalises a raw model response into a verdict.
 *
 * Anything unrecognised becomes `unclear` — the safe direction, since `unclear` never counts
 * against a template. A malformed response must not be able to retire a working regex.
 */
export function parseAdjudication(raw: unknown): AdjudicationResult {
  const o = (raw ?? {}) as Record<string, unknown>
  const verdict = o.verdict
  const known: AdjudicationVerdict[] = [
    'parse_error',
    'not_transaction',
    'user_preference',
    'duplicate',
    'unclear',
  ]
  const v = known.includes(verdict as AdjudicationVerdict) ? (verdict as AdjudicationVerdict) : 'unclear'
  const confidence =
    typeof o.confidence === 'number' ? Math.max(0, Math.min(1, o.confidence)) : 0

  const rawCorrected = o.corrected as Record<string, unknown> | null | undefined
  // A correction is only meaningful for parse_error; ignore it otherwise so a confused
  // response cannot inject an exemplar.
  const corrected =
    v === 'parse_error' && rawCorrected && typeof rawCorrected === 'object'
      ? {
          amount: typeof rawCorrected.amount === 'number' ? rawCorrected.amount : null,
          currency: typeof rawCorrected.currency === 'string' ? rawCorrected.currency : null,
          kind: typeof rawCorrected.kind === 'string' ? rawCorrected.kind : null,
          last4: typeof rawCorrected.last4 === 'string' ? rawCorrected.last4 : null,
          date: typeof rawCorrected.date === 'string' ? rawCorrected.date : null,
        }
      : undefined

  return {
    verdict: v,
    confidence,
    ...(corrected ? { corrected } : {}),
    ...(typeof o.reason === 'string' ? { reason: o.reason.slice(0, 300) } : {}),
  }
}

/**
 * Masks digits and name-like tokens so a stored exemplar carries the message's SHAPE without its
 * personal data. Exemplars are read back into prompts and shown in admin, and real SMS bodies
 * contain account numbers and people's names.
 */
export function redactBody(body: string): string {
  return body
    // Long digit runs (accounts, references, phone numbers) — keep currency amounts readable
    // by leaving 1-3 digit groups and decimals alone.
    .replace(/\d[\d,]{3,}(?:\.\d+)?/g, '#####')
    .replace(/\*{2,}\d+/g, '****')
    // Runs of 2+ capitalised words are almost always a person's name in this corpus.
    .replace(/\b[A-Z][A-Z'’-]{2,}(?:\s+[A-Z][A-Z'’-]{2,})+\b/g, '<NAME>')
}
