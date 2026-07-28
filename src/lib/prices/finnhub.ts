/**
 * Finnhub — keyed. `GET /api/v1/quote?symbol=AAPL&token=<key>` returns the current price for a
 * global-market ticker (~15–20 min delayed on the free tier). `c` is the current price, 0 when the
 * symbol is unknown/halted. One call per ticker — driven by the distinct tickers users actually hold.
 */
export interface StockQuote {
  symbol: string
  price: number
}

/** Parse a Finnhub /quote response for `symbol`. Returns null when halted/unknown (c === 0). */
export function parseFinnhubQuote(symbol: string, json: unknown): StockQuote | null {
  if (!json || typeof json !== 'object') return null
  const c = (json as { c?: unknown }).c
  if (typeof c !== 'number' || !Number.isFinite(c) || c <= 0) return null
  return { symbol, price: c }
}

export function finnhubQuoteUrl(symbol: string, token: string): string {
  return `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`
}
