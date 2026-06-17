import type { AIResponse } from '@/lib/ai/gemini'

/**
 * Create-actions the lean tier-1 voice extractor is allowed to produce. If a
 * tier-1 result contains none of these, it's out of scope and must escalate to
 * the full brain (tier-2). Kept in sync with `buildVoiceExtractPrompt`.
 */
export const ADD_ACTIONS: ReadonlySet<string> = new Set<string>([
  'add_expense', 'add_income', 'add_debt', 'add_debt_payment',
  'deposit_savings', 'withdraw_savings', 'add_savings_account', 'add_payment_method',
])

/**
 * Tier-1 result is out of its depth → re-run the full brain. Mirrors the SMS
 * confidence gate: escalate when no add-action was produced, confidence is low,
 * or the model explicitly bailed (escalate / query / unclear).
 */
export function needsEscalation(r: AIResponse): boolean {
  if (!r.actions.some((a) => ADD_ACTIONS.has(a.action))) return true
  if (r.confidence < 0.5) return true
  return r.actions.some(
    (a) => a.action === 'escalate' || a.action === 'query' || a.action === 'unclear',
  )
}
