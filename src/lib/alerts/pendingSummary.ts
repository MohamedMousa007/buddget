/**
 * Things that need the user, as kinds with a count. One list feeds the Flow row, the Inbox "Needs you" tab and (later)
 * the avatar dot and the push, so they can never disagree about what is waiting or how many.
 */
export type PendingKind = 'heldMessages' | 'unplacedExpenses'

export interface PendingEntry {
  kind: PendingKind
  count: number
  /** When the oldest item of this kind started waiting (ms); drives the red escalation. */
  since?: number
}

/** The order kinds are named in: the ones that leave a balance wrong come first. */
const ORDER: PendingKind[] = ['heldMessages', 'unplacedExpenses']

/** Drops empty kinds, merges duplicates and puts the rest in naming order. */
export function pendingKinds(entries: PendingEntry[]): PendingEntry[] {
  const sums = new Map<PendingKind, PendingEntry>()
  for (const e of entries) {
    if (e.count <= 0) continue
    const prev = sums.get(e.kind)
    const since = prev?.since != null && e.since != null ? Math.min(prev.since, e.since) : (prev?.since ?? e.since)
    sums.set(e.kind, { kind: e.kind, count: (prev?.count ?? 0) + e.count, ...(since != null ? { since } : {}) })
  }
  return ORDER.filter((k) => sums.has(k)).map((k) => sums.get(k)!)
}

/** Days an answer item may wait before the dot turns red. */
export const RED_AFTER_DAYS = 7

/** The avatar dot: nothing waits, something waits (amber), or something has waited a week (red). */
export function pendingSeverity(entries: PendingEntry[], now: number): 'none' | 'amber' | 'red' {
  const kinds = pendingKinds(entries)
  if (kinds.length === 0) return 'none'
  const limit = now - RED_AFTER_DAYS * 86_400_000
  return kinds.some((e) => e.since != null && e.since <= limit) ? 'red' : 'amber'
}

export interface PendingLabels {
  /** "2 things need you": the number of kinds, not the number of items. */
  mixedTitle: (kinds: number) => string
  /** "5 bank messages". */
  label: (kind: PendingKind, count: number) => string
  /** The one line under a single kind. */
  hint: (kind: PendingKind) => string
  /** "1 more". */
  more: (hidden: number) => string
}

export type PendingCopy =
  | { mode: 'single'; entry: PendingEntry; title: string; subtitle: string }
  | { mode: 'mixed'; kinds: PendingEntry[]; title: string; subtitle: string; spoken: string }

/** How many kinds are named before "N more". */
const NAMED = 2

/** The copy for the row: one kind says what it is; two or more say how many and name them. Null when nothing waits. */
export function pendingCopy(entries: PendingEntry[], labels: PendingLabels, named: number = NAMED): PendingCopy | null {
  const kinds = pendingKinds(entries)
  if (kinds.length === 0) return null
  if (kinds.length === 1) {
    const entry = kinds[0]
    return { mode: 'single', entry, title: labels.label(entry.kind, entry.count), subtitle: labels.hint(entry.kind) }
  }
  const shown = kinds.slice(0, named).map((e) => labels.label(e.kind, e.count))
  const hidden = kinds.length - named
  return {
    mode: 'mixed',
    kinds,
    title: labels.mixedTitle(kinds.length),
    subtitle: [...shown, ...(hidden > 0 ? [labels.more(hidden)] : [])].join(' · '),
    // A screen reader hears every kind, never "+1".
    spoken: `${labels.mixedTitle(kinds.length)}: ${kinds.map((e) => labels.label(e.kind, e.count)).join(', ')}`,
  }
}
