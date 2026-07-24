/**
 * Renders `Curated DB` templates as a paste-ready `BankPatternSet` module.
 *
 * This is the last stage of the journey: a template that has proven itself in the DB can be
 * promoted into the code patterns, where it is reviewed, unit-tested in CI and immutable at
 * runtime — and, uniquely, where it also works OFFLINE, since the phone only ever ships the code
 * patterns. That offline reach is the real argument for exporting at all.
 *
 * Two things the exporter must get right, because both are irreversible once committed:
 *
 *  1. PII. `template_sample` holds a real user's SMS — account numbers and people's full names
 *     are in the corpus. A sample pasted into the repo is public and permanent, so it is
 *     redacted here and the redaction is tested.
 *  2. `verified: true`. `tryPattern` skips any pattern without it, so an export that omitted it
 *     would produce a file that silently matches nothing.
 */
import type { MappingRules } from '@/lib/sms/templateApply'

export interface ExportableTemplate {
  id: string
  sender: string
  regex_pattern: string
  template_sample: string | null
  mapping_rules: Record<string, unknown>
  kind: string | null
  match_count: number
  unique_user_count: number
}

/**
 * Masks the parts of a sample that identify a person or an account, keeping the structure that
 * makes the sample useful for review.
 */
export function redactSample(body: string): string {
  return body
    .replace(/\r?\n/g, ' ')
    // Masked or long account/reference numbers.
    .replace(/[\d*]{2,}[-*\d]{4,}/g, '****')
    .replace(/\b\d{5,}\b/g, '#####')
    // Runs of capitalised words — person names in this corpus.
    .replace(/\b[A-Z][A-Z'’-]{2,}(?:\s+[A-Z][A-Z'’-]{2,})+\b/g, 'NAME REDACTED')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** `HOTLINE-19666` / `BODY-1a2b3c4d` / `QNB EGYPT` → a valid, readable identifier. */
function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'bank'
  )
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * Maps the DB's `mapping_rules` onto the code pattern's `groups`.
 *
 * The two vocabularies differ in one place that is easy to get wrong: a template calls the
 * counterparty `merchant`, while a code pattern calls it `counterparty`.
 */
function renderGroups(rules: MappingRules): string {
  const parts: string[] = [`amount: ${rules.amount.group}`]
  if (rules.currency && 'group' in rules.currency) parts.push(`currency: ${rules.currency.group}`)
  if (rules.merchant) parts.push(`counterparty: ${rules.merchant.group}`)
  if (rules.last4) parts.push(`last4: ${rules.last4.group}`)
  if (rules.counterparty_last4) parts.push(`counterpartyLast4: ${rules.counterparty_last4.group}`)
  if (rules.datetime) parts.push(`datetime: ${rules.datetime.group}`)
  return `{ ${parts.join(', ')} }`
}

/**
 * Escapes a regex SOURCE string for embedding in a `/.../ ` literal.
 *
 * Stored patterns routinely contain a bare `/` — "for lost/stolen card call", "https://cib.eg/mb"
 * — and a raw slash terminates the literal early, emitting a file that does not compile.
 *
 * Scanned character by character rather than with a regex: a global `replace` cannot handle
 * CONSECUTIVE slashes (matching the character before each one consumes it, so `//` only gets its
 * first slash escaped), and a lookbehind would mis-handle a literal backslash followed by a
 * slash. Copying escape pairs verbatim gets both right.
 */
function escapeRegexLiteral(source: string): string {
  let out = ''
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '\\') {
      // An escape pair passes through untouched — including an already-escaped slash.
      out += ch + (source[i + 1] ?? '')
      i++
      continue
    }
    out += ch === '/' ? '\\/' : ch
  }
  return out
}

function renderPattern(tpl: ExportableTemplate): string {
  const rules = tpl.mapping_rules as unknown as MappingRules
  const kind = tpl.kind ?? rules.kind ?? 'purchase'
  const lines: string[] = []

  if (tpl.template_sample) {
    lines.push(`      // ${redactSample(tpl.template_sample)}`)
  }
  lines.push(`      // Exported from Curated DB — ${tpl.match_count} matches, ${tpl.unique_user_count} distinct users.`)
  lines.push(`      id: ${quote(`${slug(tpl.sender)}-${slug(kind)}`)},`)
  lines.push(`      regex: /${escapeRegexLiteral(tpl.regex_pattern)}/i,`)
  lines.push(`      kind: ${quote(kind)},`)
  lines.push(`      groups: ${renderGroups(rules)},`)
  if (rules.currency && 'literal' in rules.currency) {
    lines.push(`      currencyLiteral: ${quote(rules.currency.literal)},`)
  }
  if (rules.payment_instrument?.literal) {
    lines.push(`      paymentInstrument: ${quote(rules.payment_instrument.literal)},`)
  }
  // Without this `tryPattern` skips the pattern entirely and the file matches nothing.
  lines.push(`      verified: true,`)
  return `    {\n${lines.join('\n')}\n    },`
}

/**
 * Emits one `BankPatternSet` module for the given templates.
 *
 * The caller is expected to review the result before committing — this produces a diffable
 * starting point, not an automatic commit, because a pattern in code can only be retired by a
 * deploy whereas a DB row is a flag flip.
 */
export function exportAsBankPatternSet(
  templates: ExportableTemplate[],
  bankName: string,
): string {
  const senders = [...new Set(templates.map((t) => t.sender))]
  const constName = `${slug(bankName).replace(/-/g, '_').toUpperCase()}_PATTERNS`
  // Routing keys (HOTLINE-…, BODY-…) are internal grouping keys, not real sender IDs, so they
  // must not be emitted as senderIds — the code matcher would never see them.
  const realSenders = senders.filter((s) => !/^(HOTLINE|BODY)-/.test(s))

  return `import type { BankPatternSet } from './types'

/**
 * ${bankName} — exported from the Curated DB tier.
 *
 * Every pattern here earned global reach by agreeing with independent users' parses before
 * being promoted. Samples are redacted; review the regexes before committing.
 *
 * Generated from templates: ${templates.map((t) => t.id.slice(0, 8)).join(', ')}
 */
export const ${constName}: BankPatternSet = {
  bank: ${quote(bankName)},
  senderIds: [${realSenders.map((s) => quote(s.toUpperCase())).join(', ')}],
  patterns: [
${templates.map(renderPattern).join('\n')}
  ],
}
`
}
