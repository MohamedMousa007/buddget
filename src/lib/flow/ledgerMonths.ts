/** A day group's place in the all-months list: the first day of each month carries that month's header. */
export interface MonthHead {
  /** `yyyy-MM`. */
  month: string
  /** Rows in that month across all its days. */
  count: number
}

/**
 * Month headers for day groups sorted newest first (`day` is `yyyy-MM-dd`). Returns one entry per group: the
 * month head on the first group of each month, `null` on the rest.
 */
export function monthHeads(groups: readonly { day: string; rows: number }[]): (MonthHead | null)[] {
  const counts = new Map<string, number>()
  for (const g of groups) {
    const m = g.day.slice(0, 7)
    counts.set(m, (counts.get(m) ?? 0) + g.rows)
  }
  let prev = ''
  return groups.map((g) => {
    const m = g.day.slice(0, 7)
    if (m === prev) return null
    prev = m
    return { month: m, count: counts.get(m) ?? 0 }
  })
}
