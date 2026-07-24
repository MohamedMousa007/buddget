/**
 * Reach and cross-user validation for DB templates.
 *
 * `Template` (author-scoped) applies only to users who have contributed it; `Curated DB`
 * applies to everyone. Promotion from one to the other needs evidence that the regex is
 * correct for *other people's* messages, not just its author's.
 *
 * The obvious way to gather that evidence — "N distinct users independently produced the same
 * regex" — cannot work. Generation is non-deterministic: the parse log contains three different
 * regexes produced for one identical HSBC SMS in a single call. Since the dedupe index is
 * `(sender, md5(regex_pattern))`, byte-identity would essentially never recur and no template
 * would ever promote.
 *
 * So validation is BEHAVIOURAL. When another user's SMS reaches the AI tier, the templates that
 * user cannot use are tested against it anyway: if a regex extracts the same objective fields
 * the AI did, it has just proved itself on an independent user's real message. The AI call was
 * already being paid for — the second opinion is free.
 */
import { applyMappingRules, type MappingRules, type TemplateExtraction } from '@/lib/sms/templateApply'

/** Row shape the parse route fetches. */
export interface TemplateCandidate {
  id: string
  regex_pattern: string
  mapping_rules: Record<string, unknown>
  match_count: number
  tier?: string | null
  status?: string | null
  template_sample?: string | null
}

/** Amounts agree to the cent. */
const AMOUNT_EPSILON = 0.005

/**
 * The fields with one right answer, readable from the SMS itself.
 *
 * Merchant text and category are deliberately absent: they are cosmetic/subjective, and a
 * disagreement about them says nothing about whether the regex is correct.
 */
export interface ObjectiveFields {
  amount: number | null
  currency: string | null
  kind: string | null
  last4: string | null
}

/**
 * Whether two extractions describe the same transaction.
 *
 * A field only counts when BOTH sides claim it — a template that does not capture `last4`
 * must not be judged as disagreeing with an AI parse that did.
 */
export function objectiveFieldsAgree(a: ObjectiveFields, b: ObjectiveFields): boolean {
  if (a.amount != null && b.amount != null && Math.abs(a.amount - b.amount) > AMOUNT_EPSILON) return false
  if (a.currency && b.currency && a.currency.toUpperCase() !== b.currency.toUpperCase()) return false
  if (a.kind && b.kind && a.kind !== b.kind) return false
  if (a.last4 && b.last4 && a.last4 !== b.last4) return false
  return true
}

export function extractionToObjective(e: TemplateExtraction): ObjectiveFields {
  return { amount: e.amount, currency: e.currency, kind: e.kind, last4: e.last4 }
}

/**
 * Splits fetched candidates into the ones this user may PARSE with and the ones that can only
 * be TESTED for validation evidence.
 *
 * Both sets come from a single fetch: a `template`-tier row the user has not contributed to is
 * exactly the row that needs independent validation, so no extra query is needed.
 *
 * Ordering is explicit rather than relying on the query's `order`, because sorting tier as text
 * puts `curated_db` before `template` only by alphabetical luck. Trusted first, then the
 * best-proven, so a greedy sibling cannot shadow an established regex.
 */
export function partitionByScope(
  candidates: TemplateCandidate[],
  contributedTemplateIds: ReadonlySet<string>,
): { usable: TemplateCandidate[]; validationOnly: TemplateCandidate[] } {
  const usable: TemplateCandidate[] = []
  const validationOnly: TemplateCandidate[] = []

  for (const c of candidates) {
    if (c.tier === 'curated_db') usable.push(c)
    else if (contributedTemplateIds.has(c.id)) usable.push(c)
    else validationOnly.push(c)
  }

  const byTrust = (a: TemplateCandidate, b: TemplateCandidate) => {
    const rank = (t: TemplateCandidate) => (t.tier === 'curated_db' ? 0 : 1)
    return rank(a) - rank(b) || (b.match_count ?? 0) - (a.match_count ?? 0)
  }
  usable.sort(byTrust)
  return { usable, validationOnly }
}

export type ValidationOutcome =
  /** The regex matched this independent SMS and agreed — evidence of correctness. */
  | { templateId: string; result: 'agreed' }
  /** The regex matched but extracted something else — evidence of a defect. */
  | { templateId: string; result: 'disagreed'; detail: string }

/**
 * Tests templates this user cannot parse with against their SMS, comparing to what the AI
 * produced. A template that does not match at all yields nothing — absence of a match is not
 * evidence in either direction, it just means this is a different message shape.
 */
export function validateAgainstAiParse(
  message: string,
  aiFields: ObjectiveFields,
  candidates: TemplateCandidate[],
): ValidationOutcome[] {
  const out: ValidationOutcome[] = []
  for (const c of candidates) {
    const rules = c.mapping_rules as unknown as MappingRules
    if (!rules?.amount) continue
    const got = applyMappingRules(message, c.regex_pattern, rules)
    if (!got) continue
    const mine = extractionToObjective(got)
    out.push(
      objectiveFieldsAgree(mine, aiFields)
        ? { templateId: c.id, result: 'agreed' }
        : {
            templateId: c.id,
            result: 'disagreed',
            detail: `template=${got.amount}/${got.currency ?? '?'} ai=${aiFields.amount}/${aiFields.currency ?? '?'}`,
          },
    )
  }
  return out
}

/**
 * Whether a newly generated regex is just another spelling of one already in the bucket.
 *
 * Two regexes are the same TEMPLATE when they behave the same, not when their text matches.
 * Each is run over the other's stored sample; if both agree on the objective fields wherever
 * they match, they are equivalent and should be merged rather than stored twice.
 *
 * This is what keeps the 10-per-key cap from filling with cosmetic variants of one template —
 * and the cap must be checked AFTER this, or a popular bucket fills up and blocks the very
 * contributors whose agreement drives promotion.
 */
export function behaviourallyEquivalent(
  a: { regex: string; rules: MappingRules; sample: string },
  b: { regex: string; rules: MappingRules; sample: string },
): boolean {
  const pairs: Array<[string, string]> = [
    [a.sample, b.sample],
    [b.sample, a.sample],
  ]
  let agreements = 0

  for (const [sample] of pairs) {
    const ea = applyMappingRules(sample, a.regex, a.rules)
    const eb = applyMappingRules(sample, b.regex, b.rules)
    // Both must reach a verdict on the same text for it to be evidence.
    if (!ea || !eb) continue
    if (!objectiveFieldsAgree(extractionToObjective(ea), extractionToObjective(eb))) return false
    agreements++
  }

  // Never merge on zero evidence: two regexes that each only match their own sample are
  // different templates that happen to share a bucket.
  return agreements > 0
}
