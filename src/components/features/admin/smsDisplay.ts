import type { Tone } from './ui/Pill'
import type { SmsTrackedRow } from './types'

export const UNDELIVERED_MS = 2 * 60 * 1000

export const FAILURE_LABELS: Record<string, string> = {
  gemini_error: 'AI error', not_transaction: 'Not a transaction', null_amount: 'No amount', low_confidence: 'Low confidence',
  duplicate: 'Duplicate', log_insert_failed: 'Save failed', insert_failed: 'Save failed', parse_exception: 'Parse crash',
  processing: 'Processing', timed_out: 'Timed out', rate_limited: 'Rate limited', not_configured: 'AI not configured',
}

/**
 * The stages of a template's journey, as they appear on a parse-log row:
 * Fully Curated (code) → Curated DB (global) → Template (author-scoped) → AI - new SMS.
 * Legacy keys are kept so rows written before migration 0097 still render.
 */
export const METHOD: Record<string, { label: string; tone: Tone }> = {
  fully_curated: { label: 'Fully curated', tone: 'good' }, curated_db: { label: 'Curated DB', tone: 'brand' },
  template: { label: 'Template', tone: 'neutral' }, ai_new: { label: 'AI · new SMS', tone: 'warn' },
  curated: { label: 'Fully curated', tone: 'good' }, promoted: { label: 'Curated DB', tone: 'brand' },
  static: { label: 'Template', tone: 'neutral' }, ai: { label: 'AI · new SMS', tone: 'warn' },
}

/** AI template-learning outcome, shown under the AI method. */
export const LEARN: Record<string, { label: string; tone: Tone }> = {
  learned: { label: 'learned', tone: 'good' }, duplicate: { label: 'dup', tone: 'good' }, merged_equivalent: { label: 'merged', tone: 'good' },
  pending: { label: 'pending', tone: 'brand' },
  cap_reached: { label: 'cap', tone: 'warn' }, skipped_low_conf: { label: 'low-conf', tone: 'warn' }, skipped_no_key: { label: 'no-key', tone: 'warn' },
  skipped_not_tx: { label: 'not-tx', tone: 'warn' }, blocked_retired: { label: 'blocked', tone: 'warn' },
  gemini_error: { label: 'ai-err', tone: 'bad' }, no_json: { label: 'no-json', tone: 'bad' }, no_regex_or_amount: { label: 'bad-rule', tone: 'bad' },
  regex_invalid: { label: 'bad-regex', tone: 'bad' }, regex_no_match: { label: 'no-match', tone: 'bad' },
  gate_amount_mismatch: { label: 'gate:amount', tone: 'bad' }, gate_currency_mismatch: { label: 'gate:ccy', tone: 'bad' },
  gate_last4_mismatch: { label: 'gate:last4', tone: 'bad' }, gate_wrong_token_balance: { label: 'gate:balance', tone: 'bad' },
  gate_capture_unsound: { label: 'gate:capture', tone: 'bad' }, gate_regex_too_greedy: { label: 'gate:greedy', tone: 'bad' },
  gate_no_match: { label: 'gate:no-match', tone: 'bad' }, insert_failed: { label: 'ins-fail', tone: 'bad' }, exception: { label: 'exc', tone: 'bad' },
}

export function isFailedRow(status: string): boolean {
  return status === 'failed' || status === 'add_failed'
}

/**
 * Row status. "Confirmed" is the only true success: a push was delivered AND the app acked the render.
 * A logged/notified row still waiting past 2 minutes is flagged "Not confirmed".
 */
export function rowStatus(row: SmsTrackedRow, now: number): { label: string; tone: Tone } {
  const undelivered = (row.status === 'logged' || row.status === 'notified') && now - new Date(row.received_at).getTime() > UNDELIVERED_MS
  if (undelivered) return { label: 'Not confirmed', tone: 'warn' }
  // A parsed row with neither expense nor income linked never produced a transaction, however far its status advanced.
  if (row.parsed_ok && !row.expense_id && !row.income_id && !['add_failed', 'rejected', 'failed', 'paired'].includes(row.status)) {
    return { label: 'No transaction', tone: 'bad' }
  }
  switch (row.status) {
    case 'confirmed': return { label: 'Confirmed', tone: 'good' }
    case 'tapped': return { label: 'Tapped · manual', tone: 'warn' }
    case 'rendered': return { label: 'In-app only', tone: 'warn' }
    case 'paired': return { label: 'Paired', tone: 'brand' }
    case 'notified': return { label: 'Pushed', tone: 'brand' }
    case 'logged': return { label: 'Logged', tone: 'brand' }
    case 'processing': return { label: 'Processing', tone: 'brand' }
    case 'add_failed': return { label: 'Add failed', tone: 'bad' }
    case 'rejected': return { label: FAILURE_LABELS[row.failure_code ?? ''] ?? 'Rejected', tone: 'neutral' }
    case 'failed': return { label: FAILURE_LABELS[row.failure_code ?? ''] ?? 'Failed', tone: 'bad' }
    default: return { label: row.status, tone: 'neutral' }
  }
}
