import type { HasId } from './types'

export interface DiffResult<T extends HasId> {
  inserts: T[]
  updates: T[]
  deletes: string[]
}

/**
 * Structural deep-equality for plain JSON-compatible values. Good enough for
 * diffing Zustand state snapshots — we don't have class instances, Dates (we use ISO strings),
 * Maps or Sets on any of the domain types.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const aKeys = Object.keys(ao)
  const bKeys = Object.keys(bo)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) if (!deepEqual(ao[k], bo[k])) return false
  return true
}

/**
 * Compute the inserts/updates/deletes needed to move the remote store from
 * `prev` to `next`. IDs missing from `next` become deletes; IDs missing from `prev`
 * become inserts; IDs in both with structural differences become updates.
 */
export function diffLists<T extends HasId>(next: readonly T[], prev: readonly T[]): DiffResult<T> {
  const prevMap = new Map<string, T>()
  for (const x of prev) prevMap.set(x.id, x)

  const inserts: T[] = []
  const updates: T[] = []
  const nextIds = new Set<string>()

  for (const item of next) {
    nextIds.add(item.id)
    const before = prevMap.get(item.id)
    if (!before) {
      inserts.push(item)
    } else if (!deepEqual(before, item)) {
      updates.push(item)
    }
  }

  const deletes: string[] = []
  for (const x of prev) if (!nextIds.has(x.id)) deletes.push(x.id)

  return { inserts, updates, deletes }
}

/**
 * Singleton diff: returns the new value when it differs from the previous, otherwise null.
 * Used for `profile`, `user_settings`, `onboarding_state` — one row per user.
 */
export function diffSingleton<T>(next: T, prev: T | null | undefined): T | null {
  if (prev == null) return next
  return deepEqual(next, prev) ? null : next
}
