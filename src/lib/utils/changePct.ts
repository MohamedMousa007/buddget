/** Past this a percent change stops meaning anything to a reader: chips show ">999%". */
export const CHANGE_PCT_CAP = 999

/**
 * Percent change from `before` to `now`, signed. Null when `before` is near zero next to `now` (under 1% of it):
 * growing from almost nothing is not a percentage worth showing.
 */
export function changePct(now: number, before: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(before)) return null
  if (Math.abs(before) < Math.max(1e-9, Math.abs(now) / 100)) return null
  return ((now - before) / Math.abs(before)) * 100
}

/** The absolute change for a chip: "12%", ">999%"; with `digits: 1`, one decimal under 10 ("3.2%"). */
export function formatChangePct(pct: number, digits: 0 | 1 = 0): string {
  const a = Math.abs(pct)
  if (a > CHANGE_PCT_CAP) return `>${CHANGE_PCT_CAP}%`
  return `${digits === 1 && a < 10 ? a.toFixed(1) : Math.round(a)}%`
}
