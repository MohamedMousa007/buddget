export const PURGE_WARN_DAYS = 7
export const MAX_NOTES = 4000
const DAY_MS = 86_400_000

export type Countdown =
  | { state: 'off' }
  | { state: 'empty'; keepDays: number }
  | { state: 'ok'; keepDays: number; purgeAt: string; daysLeft: number; due: boolean }

/** `platform_settings.sms_raw_keep_days_parsed`: a positive whole number of days. Missing, null, 0 or junk means retention is off. */
export function parseKeepDays(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null
}

/** Days until the oldest unreviewed raw body reaches its keep window (the next purge batch). Never negative. */
export function computeCountdown(keepDays: number | null, oldestRawAt: string | null, now: Date): Countdown {
  if (keepDays === null) return { state: 'off' }
  if (!oldestRawAt) return { state: 'empty', keepDays }
  const purge = new Date(new Date(oldestRawAt).getTime() + keepDays * DAY_MS)
  const daysLeft = Math.max(0, Math.ceil((purge.getTime() - now.getTime()) / DAY_MS))
  return { state: 'ok', keepDays, purgeAt: purge.toISOString(), daysLeft, due: daysLeft <= PURGE_WARN_DAYS }
}

export function bannerText(daysLeft: number): string {
  return daysLeft === 0 ? 'Purge is due today. Analyse before masking' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to purge. Analyse before masking`
}

export type ReviewDecision = { ok: true; status: 'reviewed' | 'skipped'; notes: string } | { ok: false; error: string }

export function validateReview(op: unknown, notes: unknown, reason: unknown): ReviewDecision {
  if (op === 'mark_reviewed') {
    const text = typeof notes === 'string' ? notes.trim() : ''
    return { ok: true, status: 'reviewed', notes: text.slice(0, MAX_NOTES) }
  }
  if (op === 'skip') {
    const text = typeof reason === 'string' ? reason.trim() : ''
    if (!text) return { ok: false, error: 'Give a reason for skipping.' }
    return { ok: true, status: 'skipped', notes: text.slice(0, MAX_NOTES) }
  }
  return { ok: false, error: 'Unknown op.' }
}

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function packToCsv(rows: ReadonlyArray<Record<string, unknown>>): string {
  if (rows.length === 0) return ''
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')
}

export interface CoverageRow {
  bank: string
  total: number
  curated: number
  template: number
  ai: number
  failed: number
  top_unlearned: string[]
}

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)

/** Normalises whatever shape `sms_coverage_by_bank` returns into display rows; shares are fractions of `total`. */
export function normaliseCoverage(raw: unknown): CoverageRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r: Record<string, unknown>) => ({
    bank: String(r.bank ?? r.sender_key ?? r.sender ?? 'unknown'),
    total: count(r.total),
    curated: count(r.curated),
    template: count(r.template),
    ai: count(r.ai),
    failed: count(r.failed),
    top_unlearned: Array.isArray(r.top_unlearned) ? r.top_unlearned.map(String).slice(0, 5) : [],
  })).sort((a, b) => b.total - a.total)
}

export const share = (part: number, total: number): number => (total > 0 ? part / total : 0)
