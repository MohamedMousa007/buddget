export interface NetWorthTrend {
  points: number[]
  pct: number
  dir: 'up' | 'down'
}

/** Null until there are two snapshots: never a made-up trend. */
export function buildNetWorthTrend(rows: ReadonlyArray<{ net_worth: number | string }> | null): NetWorthTrend | null {
  if (!rows || rows.length < 2) return null
  const points = rows.map((r) => Number(r.net_worth))
  const first = points[0]
  const last = points[points.length - 1]
  return { points, pct: first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100, dir: last >= first ? 'up' : 'down' }
}
