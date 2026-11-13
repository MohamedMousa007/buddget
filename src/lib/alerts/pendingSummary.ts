/**
 * Things that need the user, as kinds with a count. One list feeds the Flow row, the Inbox "Needs you" tab and (later)
 * the avatar dot and the push, so they can never disagree about what is waiting or how many.
 */
export type PendingKind = 'heldMessages' | 'unplacedExpenses'

export interface PendingEntry {
  kind: PendingKind
  count: number
}

/** The order kinds are named in: the ones that leave a balance wrong come first. */
const ORDER: PendingKind[] = ['heldMessages', 'unplacedExpenses']

/** Drops empty kinds, merges duplicates and puts the rest in naming order. */
export function pendingKinds(entries: PendingEntry[]): PendingEntry[] {
  const sums = new Map<PendingKind, number>()
  for (const e of entries) if (e.count > 0) sums.set(e.kind, (sums.get(e.kind) ?? 0) + e.count)
  return ORDER.filter((k) => sums.has(k)).map((kind) => ({ kind, count: sums.get(kind)! }))
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
