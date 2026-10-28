import { parseIsoDate } from '@/lib/buddgy/tools/writeKit'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { localTodayISO } from '@/lib/utils/localDate'

/** Hard bounds for the legacy voice/AI action path. Wider than Buddgy's auto-apply window, which only decides whether a tap is needed. */
export const LEGACY_MAX_AMOUNT = 10_000_000
export const LEGACY_PAST_DAYS = 62
export const LEGACY_FUTURE_DAYS = 7

export function checkAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'The amount must be above zero.'
  if (amount > LEGACY_MAX_AMOUNT) return `The amount is too large (max ${LEGACY_MAX_AMOUNT.toLocaleString('en-US')}).`
  return null
}

/** Empty or absent is fine (today is used); anything else must be a real date near today. */
export function checkDate(raw: unknown, now: Date = new Date()): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  const date = parseIsoDate(raw)
  if (!date) return 'The date must be a real date like 2026-10-19.'
  const today = localTodayISO(now)
  const diff = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
  if (diff > LEGACY_FUTURE_DAYS || diff < -LEGACY_PAST_DAYS) {
    return `The date must be within ${LEGACY_PAST_DAYS} days back or ${LEGACY_FUTURE_DAYS} days ahead of today.`
  }
  return null
}

export function checkCategory(raw: unknown): string | null {
  return EXPENSE_ENTRY_CATEGORIES.includes(String(raw) as (typeof EXPENSE_ENTRY_CATEGORIES)[number]) ? null : `Unknown category "${String(raw)}".`
}

export type HintMatch<T> = { kind: 'one'; item: T } | { kind: 'none' } | { kind: 'many'; items: T[] }

/**
 * Finds the one record a spoken hint names. An empty hint matches nothing; an exact name wins over a
 * partial one; several partial matches are reported instead of silently picking the first.
 */
export function matchByHint<T>(items: T[], hint: string, names: (item: T) => string[]): HintMatch<T> {
  const t = hint.trim().toLowerCase()
  if (!t) return { kind: 'none' }
  const lowered = (item: T) => names(item).map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0)
  const pick = (hits: T[]): HintMatch<T> => (hits.length === 1 ? { kind: 'one', item: hits[0] } : hits.length > 1 ? { kind: 'many', items: hits } : { kind: 'none' })
  const exact = items.filter((i) => lowered(i).includes(t))
  if (exact.length) return pick(exact)
  return pick(items.filter((i) => lowered(i).some((n) => n.includes(t) || (n.length >= 3 && t.includes(n)))))
}

export function ambiguityMessage(noun: string, hint: string, labels: string[]): string {
  return `"${hint}" matches several ${noun}: ${labels.slice(0, 5).join('; ')}. Say which one.`
}
