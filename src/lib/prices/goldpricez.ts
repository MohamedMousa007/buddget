/**
 * goldpricez — keyed. `GET /api/rates/currency/{cur}/measure/gram` with header `X-API-KEY: <key>`.
 * A second gold upstream for the pegged Gulf currencies (AED/SAR) and EGP corroboration. The free
 * response carries a per-gram 24k price; karat prices derive by purity. Response shapes vary, so
 * parse defensively for any per-gram gold number.
 */
export function parseGoldpricezGram24k(json: unknown): number | null {
  const pick = (o: Record<string, unknown>, keys: string[]): number | null => {
    for (const k of keys) {
      const v = o[k]
      const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
      if (Number.isFinite(n) && n > 0) return n
    }
    return null
  }
  if (!json || typeof json !== 'object') {
    const n = Number(json)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const o = json as Record<string, unknown>
  return pick(o, ['gram_in_24k', 'ounce_price_24k', 'gram_24k', 'price_gram_24k', 'rate'])
}

export function goldpricezUrl(currency: string): string {
  return `https://goldpricez.com/api/rates/currency/${currency.toLowerCase()}/measure/gram`
}
