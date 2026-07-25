/**
 * Per-class staleness windows. A cached price older than its window is treated as UNAVAILABLE
 * (fail-closed) — never served stale. Clients read asset_prices and apply this; they never call
 * providers directly (free-tier rate limits, F8).
 */
export const STALENESS_MS: Record<string, number> = {
  gold: 6 * 60 * 60 * 1000, // 6h
  crypto: 6 * 60 * 60 * 1000, // 6h
  fx: 12 * 60 * 60 * 1000, // 12h — Sagha dollar / official rate
  stock: 48 * 60 * 60 * 1000, // 48h — EOD + weekend
}

const DEFAULT_MS = 6 * 60 * 60 * 1000

export function stalenessWindowMs(assetClass: string): number {
  return STALENESS_MS[assetClass] ?? DEFAULT_MS
}

/** True when `asOf` is within the asset class's freshness window relative to `now`. */
export function isPriceFresh(asOf: string | Date, assetClass: string, now: Date = new Date()): boolean {
  const t = typeof asOf === 'string' ? Date.parse(asOf) : asOf.getTime()
  if (!Number.isFinite(t)) return false
  const age = now.getTime() - t
  return age >= 0 && age <= stalenessWindowMs(assetClass)
}
