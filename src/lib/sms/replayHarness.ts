import { applyMappingRules, type MappingRules } from '@/lib/sms/templateApply'

/**
 * Replay harness (LF5): runs a set of known shapes against a template or a parse function and reports
 * what regressed. Pure: callers load the cases (masked shapes from sms_corpus, golden fixtures) and
 * decide what to do with the verdict. Fixtures and stored shapes are masked: digits are synthetic.
 */

export interface ReplayExpectation {
  /** True when a correct parser extracts this message, false for a shape no template may match (OTP, marketing, balance-only). */
  matches: boolean
  amount?: number
  currency?: string
  kind?: string
  last4?: string
}

export interface ReplayCase {
  id: string
  body: string
  expect: ReplayExpectation
}

export interface ReplayOutcome {
  amount: number | null
  currency: string | null
  kind: string | null
  last4: string | null
}

export type RegressionReason = 'false_positive' | 'not_matched' | 'amount_changed' | 'currency_changed' | 'kind_changed' | 'last4_changed'

export interface Regression {
  id: string
  reason: RegressionReason
}

export interface ReplayReport {
  ok: boolean
  checked: number
  regressions: Regression[]
}

/** A stored masked shape ('#' per digit run) turned back into a message a regex can be run on. */
export function materializeShape(redacted: string): string {
  return redacted.replace(/#+/g, (run) => '9'.repeat(Math.max(run.length, 1)))
}

function compare(c: ReplayCase, got: ReplayOutcome | null, requireMatch: boolean): RegressionReason | null {
  if (!c.expect.matches) return got ? 'false_positive' : null
  if (!got) return requireMatch ? 'not_matched' : null
  const e = c.expect
  if (e.amount != null && (got.amount == null || Math.abs(got.amount - e.amount) > 0.005)) return 'amount_changed'
  if (e.currency && got.currency && got.currency.toUpperCase() !== e.currency.toUpperCase()) return 'currency_changed'
  if (e.kind && got.kind && got.kind !== e.kind) return 'kind_changed'
  if (e.last4 && got.last4 && got.last4 !== e.last4) return 'last4_changed'
  return null
}

/** Replays `cases` against any parse function (a parser release): a case that should match but no longer does is a regression. */
export function replayAgainst(parse: (body: string) => ReplayOutcome | null, cases: readonly ReplayCase[]): ReplayReport {
  const regressions: Regression[] = []
  for (const c of cases) {
    let got: ReplayOutcome | null = null
    try { got = parse(c.body) } catch { got = null }
    const reason = compare(c, got, true)
    if (reason) regressions.push({ id: c.id, reason })
  }
  return { ok: regressions.length === 0, checked: cases.length, regressions }
}

/**
 * Pre-promotion / pre-store check for ONE template: it may not match a shape that must not match, and
 * where it does match a known shape it must agree with the known values. Not matching a shape is fine,
 * a single template is not expected to cover everything.
 */
export function replayCandidate(template: { regex: string; rules: MappingRules }, cases: readonly ReplayCase[]): ReplayReport {
  const regressions: Regression[] = []
  for (const c of cases) {
    const x = applyMappingRules(c.body, template.regex, template.rules)
    const got: ReplayOutcome | null = x ? { amount: x.amount, currency: x.currency, kind: x.kind, last4: x.last4 } : null
    const reason = compare(c, got, false)
    if (reason) regressions.push({ id: c.id, reason })
  }
  return { ok: regressions.length === 0, checked: cases.length, regressions }
}
