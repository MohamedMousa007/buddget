/**
 * Live rates must always exist (owner rule): a conversion the last day's fetch did not price is an error shown to the
 * user, even when the built-in fallback table still does the arithmetic. This module only answers "is it live?".
 */
export const LIVE_RATE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const asUsd = (c: string) => (c === 'USDT' || c === 'USDC' ? 'USD' : c)

/** Dates every pair key a fetch returned; keys it left out keep their older stamp. */
export function stampRateKeys(prev: Readonly<Record<string, string>>, rates: Readonly<Record<string, number>>, at: string): Record<string, string> {
  const next = { ...prev }
  for (const [key, rate] of Object.entries(rates)) if (Number.isFinite(rate) && rate > 0) next[key] = at
  return next
}

/** Whether a fetch within the last day returned the from→to pair (either direction). */
export function hasLiveRate(fromCurrency: string, toCurrency: string, fetchedAt: Readonly<Record<string, string>>, now: number): boolean {
  const from = asUsd(fromCurrency)
  const to = asUsd(toCurrency)
  if (from === to) return true
  const stamp = fetchedAt[`${from}_${to}`] ?? fetchedAt[`${to}_${from}`]
  const t = stamp ? Date.parse(stamp) : Number.NaN
  return Number.isFinite(t) && now - t <= LIVE_RATE_MAX_AGE_MS
}

/** Whether rates must be fetched: stale past the TTL, never fetched, or never stamped per pair (a store from before stamps). */
export function ratesNeedFetch(lastRatesFetch: string | null, fetchedAt: Readonly<Record<string, string>>, now: number, ttlMs: number): boolean {
  return !lastRatesFetch || Object.keys(fetchedAt).length === 0 || now - new Date(lastRatesFetch).getTime() > ttlMs
}
