import type { GoalFrequency } from '@/lib/store/types'

export type PaceZone = 'easy' | 'comfortable' | 'stretch' | 'ambitious' | 'unknown'

export interface PaceInput {
  target: number
  saved: number
  /** `YYYY-MM-DD` */
  targetDate: string
  frequency: GoalFrequency
  /** Monthly amount the user usually keeps; null = unknown. */
  usualKeep: number | null
  now: Date
}

export interface PaceResult {
  periods: number
  /** Amount asked per period (month or quarter). */
  asked: number
  /** asked / usual keep per same period; null when unknown. */
  ratio: number | null
  zone: PaceZone
  /** Meter fill 0-100; the usual tick sits at 62. */
  fill: number
  /** Earliest `YYYY-MM-01` where the ask fits the usual keep; null when none within 5 years. */
  altDate: string | null
  /** Smaller target that fits the original date, offered when altDate is too far out. */
  altTarget: number | null
}

export const USUAL_TICK = 62
const MAX_ALT_MONTHS = 60

const step = (f: GoalFrequency) => (f === 'quarterly' ? 3 : 1)

export function monthsUntil(now: Date, iso: string): number {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth())
}

/** Periods from the next period start to the target date; always at least 1. */
export function periodsUntil(now: Date, iso: string, f: GoalFrequency): number {
  return Math.max(1, Math.ceil(monthsUntil(now, iso) / step(f)))
}

export function addMonthsIso(now: Date, months: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function zoneFor(ratio: number): Exclude<PaceZone, 'unknown'> {
  if (ratio <= 0.6) return 'easy'
  if (ratio <= 1) return 'comfortable'
  if (ratio <= 1.4) return 'stretch'
  return 'ambitious'
}

export function computePace(i: PaceInput): PaceResult {
  const remaining = Math.max(0, i.target - i.saved)
  const periods = periodsUntil(i.now, i.targetDate, i.frequency)
  const asked = remaining / periods
  const keep = i.usualKeep && i.usualKeep > 0 ? i.usualKeep * step(i.frequency) : null
  if (keep === null) {
    return { periods, asked, ratio: null, zone: 'unknown', fill: 0, altDate: null, altTarget: null }
  }
  const ratio = asked / keep
  const zone = zoneFor(ratio)
  let altDate: string | null = null
  let altTarget: number | null = null
  if (zone === 'stretch' || zone === 'ambitious') {
    const fitPeriods = Math.ceil(remaining / keep)
    const months = fitPeriods * step(i.frequency)
    if (months <= MAX_ALT_MONTHS) altDate = addMonthsIso(i.now, months)
    else altTarget = Math.floor(i.saved + keep * periods)
  }
  return { periods, asked, ratio, zone, fill: Math.min(100, ratio * USUAL_TICK), altDate, altTarget }
}

export interface ReplanInput {
  remaining: number
  targetDate: string
  frequency: GoalFrequency
  usualKeep: number | null
  /** Savings available per period, for expressing the raise as a share. */
  periodSavings: number | null
  now: Date
}

export interface ReplanOptions {
  /** Move the date to where the ask fits the usual keep. */
  moveDate: { targetDate: string; perPeriod: number } | null
  /** Keep the date and raise the per-period amount. */
  keepDate: { perPeriod: number; sharePct: number | null }
}

export function replanOptions(i: ReplanInput): ReplanOptions {
  const keepPeriods = periodsUntil(i.now, i.targetDate, i.frequency)
  const required = Math.max(0, i.remaining) / keepPeriods
  const sharePct =
    i.periodSavings && i.periodSavings > 0 ? Math.ceil(((required / i.periodSavings) * 100) / 5) * 5 : null
  const keep = i.usualKeep && i.usualKeep > 0 ? i.usualKeep * step(i.frequency) : null
  const moveDate = keep
    ? (() => {
        const n = Math.max(1, Math.ceil(i.remaining / keep))
        return { targetDate: addMonthsIso(i.now, n * step(i.frequency)), perPeriod: i.remaining / n }
      })()
    : null
  return { moveDate, keepDate: { perPeriod: required, sharePct } }
}

/** `YYYY-MM-01` when `remaining` is paid off at `perPeriod` per period; null when nothing is saved per period. */
export function projectedFinish(remaining: number, perPeriod: number, frequency: GoalFrequency, now: Date): string | null {
  if (!(perPeriod > 0)) return null
  return addMonthsIso(now, Math.max(1, Math.ceil(remaining / perPeriod)) * step(frequency))
}
