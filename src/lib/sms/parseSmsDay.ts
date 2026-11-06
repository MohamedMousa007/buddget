import { normalizeSmsText } from '@/lib/sms/normalizeDigits'

const EN_MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
}

const AR_MONTHS: Record<string, number> = {
  'يناير': 1, 'كانون الثاني': 1, 'فبراير': 2, 'شباط': 2, 'مارس': 3, 'آذار': 3, 'أبريل': 4, 'ابريل': 4, 'نيسان': 4, 'مايو': 5, 'أيار': 5,
  'يونيو': 6, 'يونية': 6, 'حزيران': 6, 'يوليو': 7, 'يوليه': 7, 'تموز': 7, 'أغسطس': 8, 'اغسطس': 8, 'آب': 8, 'سبتمبر': 9, 'أيلول': 9,
  'أكتوبر': 10, 'اكتوبر': 10, 'تشرين الأول': 10, 'نوفمبر': 11, 'تشرين الثاني': 11, 'ديسمبر': 12, 'كانون الأول': 12,
}

const DAY_MS = 86_400_000
const FUTURE_TOLERANCE_DAYS = 2
/** A yy/mm/dd reading is only believed this close to the receive time. */
const YEAR_FIRST_WINDOW_DAYS = 35
/** A 2-digit-year date more than this far from the receive time is a misread, not a date. */
const MAX_TWO_DIGIT_DISTANCE_DAYS = 366

function isRealDay(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function iso(year: number, month: number, day: number): string | null {
  if (!isRealDay(year, month, day)) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function fullYear(yy: string): number {
  return yy.length === 2 ? 2000 + Number(yy) : Number(yy)
}

/**
 * "26/10/24" is dd/mm/yy (2024-10-26) or yy/mm/dd (2026-10-24): both are real dates, only the receive time tells
 * them apart. The year-first reading counts only when it lands within a month of the receive time (a field above
 * 31 is never a day, and "31APR26" is not 2031). The reading nearest the receive time wins, dd/mm/yy on a tie.
 * When the receive time is known and even the nearest reading is over a year away, the text is not a transaction
 * date: null, and the caller dates the transaction by its receive time.
 */
function twoDigitYearDay(first: string, month: number, last: string, base: Date, bounded: boolean): string | null {
  const distance = (d: string) => Math.abs(Date.parse(`${d}T00:00:00Z`) - base.getTime())
  const dayFirst = iso(fullYear(last), month, Number(first))
  const yearFirst = first.length === 2 ? iso(fullYear(first), month, Number(last)) : null
  const nearest = [dayFirst, yearFirst && distance(yearFirst) <= YEAR_FIRST_WINDOW_DAYS * DAY_MS ? yearFirst : null]
    .filter((d): d is string => d !== null)
    .sort((a, b) => distance(a) - distance(b))[0]
  return nearest && (!bounded || distance(nearest) <= MAX_TWO_DIGIT_DISTANCE_DAYS * DAY_MS) ? nearest : null
}

/**
 * Year for a date printed without one: the receive year, or the year before when that would put the
 * date more than two days after the receive time (a December SMS read in January).
 */
function inferYear(month: number, day: number, ref: Date): number {
  const y = ref.getUTCFullYear()
  const candidate = Date.UTC(y, month - 1, day)
  if (candidate > ref.getTime() + FUTURE_TOLERANCE_DAYS * DAY_MS) return y - 1
  // A New Year SMS received just before UTC midnight (already January locally): the date belongs to next year.
  const next = Date.UTC(y + 1, month - 1, day)
  return ref.getTime() - candidate > 180 * DAY_MS && next <= ref.getTime() + FUTURE_TOLERANCE_DAYS * DAY_MS ? y + 1 : y
}

function monthFromName(name: string): number | null {
  const n = name.trim().replace(/\s+/g, ' ')
  return EN_MONTHS[n.toLowerCase()] ?? AR_MONTHS[n] ?? null
}

const NAME = '([A-Za-z]{3,9}|[\\u0600-\\u06ff]{3,}(?:\\s[\\u0600-\\u06ff]{3,})?)'

/**
 * Parses every date shape the banks have sent into YYYY-MM-DD; null when none fits. Time of day is
 * ignored. Shapes: dd/mm/yy(yy), dd-mm-yy(yy), dd.mm.yy(yy), yyyy-mm-dd, DDMMMYY(YY), "13 Jun 2026",
 * "Jun 13, 2026", Arabic month names, and year-less dd/mm or dd-mm (optionally followed by a 12/24h
 * time). Arabic digits and bidi marks are normalised first. A year-less date takes its year from `ref`
 * (the receive time; defaults to now) so a missing year never makes a template unusable.
 */
export function parseSmsDay(raw: string | null, ref: Date | string | null = null): string | null {
  if (!raw) return null
  const s = normalizeSmsText(raw).trim()
  const refDate = ref ? new Date(ref) : null
  const bounded = refDate !== null && Number.isFinite(refDate.getTime())
  const base = bounded ? refDate : new Date()

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/.exec(s)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/.exec(s)
  if (m) {
    if (m[3].length === 4) return iso(Number(m[3]), Number(m[2]), Number(m[1]))
    return twoDigitYearDay(m[1], Number(m[2]), m[3], base, bounded)
  }

  m = /^(\d{1,2})[-/.](\d{1,2})(?![\d/.-])/.exec(s)
  if (m) {
    const day = Number(m[1]), month = Number(m[2])
    return isRealDay(base.getUTCFullYear(), month, day) || (month === 2 && day === 29) ? iso(inferYear(month, day, base), month, day) : null
  }

  m = new RegExp(`^(\\d{1,2})\\s*[-/.]?\\s*${NAME}\\s*[-/.,]?\\s*(\\d{4}|\\d{2})?(?!\\d)`, 'u').exec(s)
  if (m) {
    const month = monthFromName(m[2])
    if (!month) return null
    if (m[3]?.length === 2) return twoDigitYearDay(m[1], month, m[3], base, bounded)
    const day = Number(m[1])
    return iso(m[3] ? fullYear(m[3]) : inferYear(month, day, base), month, day)
  }

  m = new RegExp(`^${NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})?(?!\\d)`, 'u').exec(s)
  if (m) {
    const month = monthFromName(m[1])
    if (!month) return null
    const day = Number(m[2])
    return iso(m[3] ? Number(m[3]) : inferYear(month, day, base), month, day)
  }

  return null
}
