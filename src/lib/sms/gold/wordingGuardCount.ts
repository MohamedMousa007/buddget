/**
 * How many stored messages the wording guard would divert (docs/launch/S2b2-second-review.md 3.7). Masked bodies keep
 * their words, so the closing replay can run this over them.
 */
import { guardWordsIn } from '@/lib/sms/wordingGuard'

export interface GuardCountRow {
  body: string
  /** Guard words the matched template's sample contained; empty for a template that recorded none. */
  templateGuardWords: readonly string[]
}

export interface GuardCount {
  rows: number
  /** Rows the guard would divert. */
  hits: number
  /** Rows carrying each guard word the template did not; a row with two such words counts once under each. */
  perWord: Record<string, number>
}

export function countWordingGuardHits(rows: readonly GuardCountRow[]): GuardCount {
  const out: GuardCount = { rows: rows.length, hits: 0, perWord: {} }
  for (const r of rows) {
    const unexpected = guardWordsIn(r.body).filter((w) => !r.templateGuardWords.includes(w))
    if (unexpected.length === 0) continue
    out.hits++
    for (const w of unexpected) out.perWord[w] = (out.perWord[w] ?? 0) + 1
  }
  return out
}
