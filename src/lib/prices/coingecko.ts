/**
 * CoinGecko simple-price: keyless, one call covers every coin in every fiat we need.
 * https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=aed,egp,sar,usd
 */

/** Domain crypto symbol → CoinGecko id. */
export const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
}

export const CRYPTO_VS_CURRENCIES = ['aed', 'egp', 'sar', 'usd'] as const

export interface CryptoPriceRow {
  symbol: string
  currency: string
  price: number
}

/** Parse the simple-price JSON into flat (symbol, currency, price) rows. Pure + testable. */
export function parseCoinGeckoSimplePrice(json: unknown): CryptoPriceRow[] {
  if (!json || typeof json !== 'object') return []
  const idToSymbol = Object.fromEntries(Object.entries(COINGECKO_IDS).map(([sym, id]) => [id, sym]))
  const rows: CryptoPriceRow[] = []
  for (const [id, byCur] of Object.entries(json as Record<string, unknown>)) {
    const symbol = idToSymbol[id]
    if (!symbol || !byCur || typeof byCur !== 'object') continue
    for (const [cur, price] of Object.entries(byCur as Record<string, unknown>)) {
      if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
        rows.push({ symbol, currency: cur.toUpperCase(), price })
      }
    }
  }
  return rows
}

export function coinGeckoUrl(): string {
  const ids = Object.values(COINGECKO_IDS).join(',')
  const vs = CRYPTO_VS_CURRENCIES.join(',')
  return `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vs}`
}
