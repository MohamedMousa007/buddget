/**
 * Learner retry policy (LF4). Every non-terminal learn_status maps to a failure class; each class has
 * its own retry budget and cool-down, and the reason is stored WITH the class in learn_status so the
 * admin coverage view can say why a shape is still on the paid AI tier.
 *
 * Stored form: `<class>#<attempt>|<reason>` (e.g. `bad_datetime#1|datetime group has no digits`).
 * Statuses written by older builds (`gate_capture_unsound: ...`, `no_json`, ...) are classified on read.
 */

export type LearnFailureClass = 'transient' | 'quota' | 'bad_datetime' | 'regex_loose' | 'gate_rejected' | 'terminal'

const TERMINAL = /^(?:learned|merged_equivalent|duplicate|cap_reached|blocked_retired|skipped_[a-z_]+)$/
const TRANSIENT = /^(?:gemini_error|no_json|no_regex_or_amount|insert_failed|exception|pending)\b/
const GATE_REJECTED = /^(?:gate_(?:amount_mismatch|currency_mismatch|last4_mismatch|per_user_literal|replay_regression|no_match))/
const REGEX_LOOSE = /^(?:regex_invalid|regex_no_match|gate_(?:regex_too_greedy|wrong_token_balance|regex_unsafe))/

export function classifyLearnStatus(status: string | null | undefined): LearnFailureClass {
  const s = (status ?? '').trim()
  const encoded = /^([a-z_]+)#\d+\|/.exec(s)
  if (encoded) return encoded[1] as LearnFailureClass
  if (!s) return 'transient'
  if (s === 'quota_denied') return 'quota'
  if (TERMINAL.test(s)) return 'terminal'
  if (/^gate_capture_unsound/.test(s)) return /datetime/.test(s) ? 'bad_datetime' : 'regex_loose'
  if (REGEX_LOOSE.test(s)) return 'regex_loose'
  if (GATE_REJECTED.test(s)) return 'gate_rejected'
  if (TRANSIENT.test(s)) return 'transient'
  return 'transient'
}

export function encodeLearnStatus(cls: LearnFailureClass, attempt: number, reason: string): string {
  return `${cls}#${attempt}|${reason}`.slice(0, 200)
}

export function decodeLearnAttempt(status: string | null | undefined): number {
  const m = /^[a-z_]+#(\d+)\|/.exec(status ?? '')
  return m ? Number(m[1]) : 0
}

interface Policy { maxAttempts: number; cooldownMs: number }

const HOUR = 3_600_000
const POLICY: Record<Exclude<LearnFailureClass, 'terminal'>, Policy> = {
  transient: { maxAttempts: 3, cooldownMs: HOUR },
  quota: { maxAttempts: 5, cooldownMs: 24 * HOUR },
  bad_datetime: { maxAttempts: 2, cooldownMs: 0 },
  regex_loose: { maxAttempts: 3, cooldownMs: 6 * HOUR },
  gate_rejected: { maxAttempts: 2, cooldownMs: 6 * HOUR },
}

/** Extra instruction for the next regex-generation prompt, by failure class. */
const HINT: Partial<Record<LearnFailureClass, string>> = {
  bad_datetime: 'Capture the date exactly as printed, even without a year (dd/mm, dd-mm hh:mm, month names).',
  regex_loose: 'Use lazy bounded groups, no greedy wildcards, and never capture the balance.',
  gate_rejected: 'Every capture group must reproduce the extracted value; never embed names, numbers or amounts as literals.',
}

export interface RetryDecision {
  retry: boolean
  /** Earliest time to try again (null when retry is false or immediate). */
  notBefore: Date | null
  hint: string | null
}

/** Whether a stored failure should be retried now, given when it last failed. `bad_datetime` retries at once: a parser release fixes it. */
export function decideLearnRetry(status: string | null | undefined, lastAttemptAt: Date, now: Date = new Date()): RetryDecision {
  const cls = classifyLearnStatus(status)
  if (cls === 'terminal') return { retry: false, notBefore: null, hint: null }
  const policy = POLICY[cls]
  if (decodeLearnAttempt(status) >= policy.maxAttempts) return { retry: false, notBefore: null, hint: null }
  const notBefore = new Date(lastAttemptAt.getTime() + policy.cooldownMs)
  return { retry: now >= notBefore, notBefore, hint: HINT[cls] ?? null }
}
