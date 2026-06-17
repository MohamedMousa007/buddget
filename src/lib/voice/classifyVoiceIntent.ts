import { hasCurrencyToken } from '@/lib/sms/patterns/currency'

/**
 * Cheap, AI-free pre-route for a voice transcript: decide whether to try the lean
 * tier-1 "add a transaction" extractor or go straight to the full tier-2 brain
 * (questions, budget/goal reasoning, edits).
 *
 * Biased toward `transactional` on purpose — it is the cheaper path, and tier-1
 * self-escalates to tier-2 whenever it can't produce an add-action, so a wrong
 * `transactional` guess self-corrects. We only return `complex` on a clear
 * question/analytics signal with no offsetting transaction verb.
 */
export type VoiceIntent = 'transactional' | 'complex'

/** Question / analytics phrasing (EN). */
const QUESTION_EN_RE =
  /\b(how much|how many|what'?s|what is|what are|what was|how'?s|how am i|show|list|why|when|which|do i|can i|could i|should i|am i|breakdown|summary|report|left|remaining|afford|compare|trend|average|overview)\b/i

/** Question / analytics phrasing (AR — Egyptian + MSA). */
const QUESTION_AR_RE = /كام|كم|قد ?اي[هة]|اي[هة]|لي[هة]|امتى|اعرض|اعرضلي|باقي|متبقي|ملخص|كشف|قارن|اجمالي|متوسط/

/** Casual money-movement verbs (EN) — "spent 250", "paid mom", "got salary". */
const TXN_VERB_EN_RE =
  /\b(spent|spend|paid|pay|bought|buy|borrow(?:ed)?|lent|lend|got|received|receive|deposit(?:ed)?|withdr(?:aw|ew)|saved?|sent|send|owe|charged?)\b/i

/** Casual money-movement verbs (AR). */
const TXN_VERB_AR_RE = /دفعت|صرفت|اشتريت|خدت|استلمت|حطيت|سحبت|اقترضت|وديت|بعت|ادخرت/

export function classifyVoiceIntent(text: string): VoiceIntent {
  const t = text.trim()
  if (!t) return 'transactional'

  const hasQuestion = QUESTION_EN_RE.test(t) || QUESTION_AR_RE.test(t)
  const hasTxn = TXN_VERB_EN_RE.test(t) || TXN_VERB_AR_RE.test(t) || hasCurrencyToken(t)

  // A clear question with no money-movement signal → full brain.
  if (hasQuestion && !hasTxn) return 'complex'
  return 'transactional'
}
