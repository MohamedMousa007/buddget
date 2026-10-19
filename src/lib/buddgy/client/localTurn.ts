import type { BuddgyLocale } from '@/lib/buddgy/protocol'
import type { ReadNote } from '@/lib/buddgy/client/chatTypes'
import { readLabel } from '@/lib/buddgy/client/readLabels'
import { formatLocalAnswer, matchLocalQuestion } from '@/lib/buddgy/local/localAnswers'
import { parseQuickAdd } from '@/lib/buddgy/local/parseQuickAdd'
import { buddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'
import type { Proposal } from '@/lib/buddgy/tools/proposal'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import { fin } from '@/lib/buddgy/tools/stores'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { localTodayISO } from '@/lib/utils/localDate'

/** Below this the parse is a guess, and a wrong entry is worse than asking the model. */
export const QUICK_ADD_MIN_CONFIDENCE = 0.85

export type LocalResult =
  | { kind: 'answer'; text: string; reads: ReadNote[] }
  | { kind: 'proposal'; text: string; proposals: Proposal[] }

/**
 * Handles what needs no model: a plain "coffee 45" and the common month questions. Costs no
 * tokens and works offline. Returns null whenever anything is unclear, so the caller falls
 * through to the model (or, offline, to a notice).
 */
export function runLocal(text: string, locale: BuddgyLocale, now: Date): LocalResult | null {
  const ctx = { now, locale }

  const question = matchLocalQuestion(text, locale)
  if (question) {
    const read = TOOLS.get(question.read.tool)?.read
    if (!read) return null
    const answer = formatLocalAnswer(question.id, read(question.read.args, ctx) as Record<string, unknown>, locale)
    return answer ? { kind: 'answer', text: answer, reads: [{ tool: question.read.tool, label: readLabel(question.read.tool, locale) }] } : null
  }

  const s = fin()
  const parsed = parseQuickAdd(text, {
    baseCurrency: s.settings.baseCurrency,
    knownCurrencies: [...FIAT_CURRENCIES],
    paymentMethodNames: s.paymentMethods.map((m) => ({ ref: refOf(m.id), name: m.name })),
    today: localTodayISO(now),
    locale,
  })
  if (!parsed || parsed.confidence < QUICK_ADD_MIN_CONFIDENCE) return null
  const write = TOOLS.get(parsed.tool)?.write
  if (!write) return null
  const proposed = write.propose(parsed.args, ctx)
  if (!proposed.ok) return null
  const copy = buddgyChatCopy[locale]
  return { kind: 'proposal', text: proposed.proposal.risk === 'auto' ? copy.quickAddDone : copy.quickAddLead, proposals: [proposed.proposal] }
}
