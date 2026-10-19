/**
 * Puts saved rows back by id. A restored row gets a fresh `updatedAt` when `stamp` is set:
 * the change it undoes was already synced with a newer stamp, so an old one would lose the
 * offline-merge tiebreak and the undo would not survive the next hydrate.
 */
export const putBack = <T extends { id: string }>(current: T[], saved: T[], stamp = false): T[] => {
  const now = new Date().toISOString()
  return current.map((row) => {
    const prev = saved.find((s) => s.id === row.id)
    return prev ? (stamp ? { ...prev, updatedAt: now } : prev) : row
  })
}

const sameRow = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Puts deleted rows back under their original ids and positions; rows added or edited since stay as they are. */
export const restoreRows = <T extends { id: string }>(current: T[], before: T[], removedIds: ReadonlySet<string>): T[] => {
  const live = new Map(current.map((r) => [r.id, r]))
  const known = new Set(before.map((r) => r.id))
  const restored = before.flatMap((r) => {
    const now = live.get(r.id)
    return now ? [now] : removedIds.has(r.id) ? [r] : []
  })
  return [...restored, ...current.filter((r) => !known.has(r.id))]
}

/**
 * Reverts rows a cascade rewrote (`before` to `after`). A row untouched since is restored whole;
 * one edited since only gets back the cascaded `keys` that still hold the cascade's value.
 */
export const revertRows = <T extends { id: string }>(current: T[], before: T[], after: T[], keys: readonly (keyof T)[] = [], stamp = false): T[] => {
  const was = new Map(before.map((r) => [r.id, r]))
  const then = new Map(after.map((r) => [r.id, r]))
  const now = new Date().toISOString()
  return current.map((row) => {
    const prev = was.get(row.id)
    const post = then.get(row.id)
    if (!prev || !post || sameRow(prev, post)) return row
    if (sameRow(row, post)) return stamp && 'updatedAt' in prev ? { ...prev, updatedAt: now } : prev
    const patch = Object.fromEntries(keys.filter((k) => row[k] === post[k]).map((k) => [k, prev[k]]))
    return { ...row, ...patch }
  })
}

/** Keys whose value differs between any row of `before` and its counterpart in `after`. */
export const changedKeys = <T extends { id: string }>(before: T[], after: T[]): (keyof T)[] => {
  const then = new Map(after.map((r) => [r.id, r]))
  const keys = new Set<keyof T>()
  for (const prev of before) {
    const post = then.get(prev.id)
    if (!post) continue
    for (const k of Object.keys(prev) as (keyof T)[]) if (!sameRow(prev[k], post[k])) keys.add(k)
    for (const k of Object.keys(post) as (keyof T)[]) if (!sameRow(prev[k], post[k])) keys.add(k)
  }
  return [...keys]
}
