/** Credit-card terms the database accepts (CHECK constraints on debts). */
export const CARD_DAY_MIN = 1
export const CARD_DAY_MAX = 31
export const CARD_PERCENT_MIN = 0
export const CARD_PERCENT_MAX = 100

export function parseCardDay(raw: string): number | null {
  const n = Number(raw.trim())
  return raw.trim() !== '' && Number.isInteger(n) && n >= CARD_DAY_MIN && n <= CARD_DAY_MAX ? n : null
}

export function parseCardPercent(raw: string): number | null {
  const n = Number(raw.trim())
  return raw.trim() !== '' && Number.isFinite(n) && n >= CARD_PERCENT_MIN && n <= CARD_PERCENT_MAX ? n : null
}

/** Blank is allowed (no value yet); anything else must be a valid day. */
export function cardDayError(raw: string): boolean {
  return raw.trim() !== '' && parseCardDay(raw) === null
}

export function clampCardDay(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.min(CARD_DAY_MAX, Math.max(CARD_DAY_MIN, Math.round(n)))
}

export function clampCardPercent(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.min(CARD_PERCENT_MAX, Math.max(CARD_PERCENT_MIN, n))
}
