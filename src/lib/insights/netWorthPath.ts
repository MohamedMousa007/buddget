export interface NetWorthPoint {
  /** Whole days since the first point. */
  day: number
  value: number
}

export interface NetWorthPath {
  projected: number
  low: number
  high: number
  /** How many months of snapshots the line was drawn from. */
  months: number
  /** The last few monthly values the line was drawn through, oldest first (the Insights sparkline). */
  values?: number[]
}

export const MIN_HISTORY_DAYS = 90
export const MIN_HISTORY_POINTS = 4
const HORIZON_DAYS = 365
const SPARK_POINTS = 6

/**
 * A straight line through the snapshots, carried 12 months ahead, with a band of two standard errors of the
 * residuals. A rough "at this rate" for the page, never a promise: null until there are 90 days and 4 points.
 */
export function projectNetWorth(points: readonly NetWorthPoint[]): NetWorthPath | null {
  if (points.length < MIN_HISTORY_POINTS) return null
  const first = points[0].day
  const last = points[points.length - 1].day
  if (last - first < MIN_HISTORY_DAYS) return null
  const n = points.length
  const meanX = points.reduce((s, p) => s + p.day, 0) / n
  const meanY = points.reduce((s, p) => s + p.value, 0) / n
  const sxx = points.reduce((s, p) => s + (p.day - meanX) ** 2, 0)
  if (sxx === 0) return null
  const slope = points.reduce((s, p) => s + (p.day - meanX) * (p.value - meanY), 0) / sxx
  const intercept = meanY - slope * meanX
  const resid = points.reduce((s, p) => s + (p.value - (intercept + slope * p.day)) ** 2, 0)
  const sd = Math.sqrt(resid / Math.max(1, n - 2))
  const projected = intercept + slope * (last + HORIZON_DAYS)
  return { projected, low: projected - 2 * sd, high: projected + 2 * sd, months: Math.round((last - first) / 30), values: points.slice(-SPARK_POINTS).map((p) => p.value) }
}

/** One point per calendar month (the last snapshot of each), oldest first, as `day` offsets from the first. */
export function monthlyPoints(rows: ReadonlyArray<{ day: string; net_worth: number | string }>): NetWorthPoint[] {
  const byMonth = new Map<string, { day: string; value: number }>()
  for (const r of rows) {
    const month = r.day.slice(0, 7)
    const prev = byMonth.get(month)
    if (!prev || r.day > prev.day) byMonth.set(month, { day: r.day, value: Number(r.net_worth) })
  }
  const list = [...byMonth.values()].sort((a, b) => a.day.localeCompare(b.day))
  if (list.length === 0) return []
  const t0 = Date.parse(`${list[0].day}T12:00:00Z`)
  return list.map((x) => ({ day: Math.round((Date.parse(`${x.day}T12:00:00Z`) - t0) / 86_400_000), value: x.value }))
}
