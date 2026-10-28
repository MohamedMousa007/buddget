import type { BudgetBlock, CloseMemory } from '@/lib/store/types'

/** A proposal the user passed on is not repeated for this many cycles. */
const SUPPRESS_CYCLES = 3
/** Old decisions stop mattering; the memory stays small enough to ride along on the profile row. */
const KEEP_CYCLES = 6
const MAX_ENTRIES = 30

export const closeKey = (block: BudgetBlock, name: string) => `${block}:${name.trim().toLowerCase()}`

const cycleIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7))

/** True when the user already passed on this kind of change for this line recently. */
export function isSuppressed(memory: CloseMemory | undefined, key: string, kind: 'raise' | 'lower', cycleKey: string): boolean {
  const seen = memory?.[key]
  return !!seen && seen.outcome === 'passed' && seen.kind === kind && cycleIndex(cycleKey) - cycleIndex(seen.cycle) < SUPPRESS_CYCLES
}

/**
 * What the month-close sheet taught us: which proposals were applied and which were passed. Written once, when the
 * user finishes the sheet, so learning costs one small profile write a month.
 */
export function nextCloseMemory(
  prev: CloseMemory | undefined,
  proposals: ReadonlyArray<{ key?: string; lineId: string; kind: 'raise' | 'lower' }>,
  appliedLineIds: ReadonlySet<string>,
  cycleKey: string,
): CloseMemory {
  const next: CloseMemory = {}
  for (const [k, v] of Object.entries(prev ?? {})) if (cycleIndex(cycleKey) - cycleIndex(v.cycle) < KEEP_CYCLES) next[k] = v
  for (const p of proposals) {
    if (!p.key) continue
    next[p.key] = { kind: p.kind, cycle: cycleKey, outcome: appliedLineIds.has(p.lineId) ? 'applied' : 'passed' }
  }
  const newest = Object.entries(next).sort((a, b) => cycleIndex(b[1].cycle) - cycleIndex(a[1].cycle)).slice(0, MAX_ENTRIES)
  return Object.fromEntries(newest)
}
