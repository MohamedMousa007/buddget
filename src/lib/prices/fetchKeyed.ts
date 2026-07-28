import type { ServiceClient } from '@/lib/supabase/service'
import type { GoldKarat } from '@/lib/store/types'
import { priceConsensus, type PriceSample } from '@/lib/prices/consensus'
import { goldPurityFactor } from '@/lib/utils/calculations'
import { parseGoldApiKarats } from '@/lib/prices/goldApiIo'
import { parseGoldpricezGram24k } from '@/lib/prices/goldpricez'
import { parseFinnhubQuote, finnhubQuoteUrl, type StockQuote } from '@/lib/prices/finnhub'

const UA = 'Mozilla/5.0 (compatible; BuddgetBot/1.0; +https://buddget.app)'

export interface KaratRow {
  karat: GoldKarat
  pricePerGram: number
  confidence: string
  sources: string
}

/**
 * Consensus 24k-per-gram for a pegged Gulf currency (AED/SAR) from the two keyed providers, with
 * 21k/18k derived by purity. GoldAPI.io gives karats directly; goldpricez gives a 24k gram we
 * cluster against it. NOT used for EGP — Egypt's local price comes from the crawled Sagha dollar,
 * a different price class that must never be averaged with spot-derived numbers.
 */
export async function fetchGulfGoldKarats(currency: 'AED' | 'SAR'): Promise<KaratRow[]> {
  const samples: PriceSample[] = []

  const goldApiKey = process.env.GOLDAPI_IO_KEY
  if (goldApiKey) {
    try {
      const res = await fetch(`https://www.goldapi.io/api/XAU/${currency}`, {
        signal: AbortSignal.timeout(6000),
        headers: { 'x-access-token': goldApiKey, 'user-agent': UA },
      })
      if (res.ok) {
        const g24 = parseGoldApiKarats(await res.json()).find((r) => r.karat === 24)
        if (g24) samples.push({ value: g24.pricePerGram, source: 'goldapi.io', upstream: 'goldapi' })
      }
    } catch {
      /* provider down */
    }
  }

  const gpzKey = process.env.GOLDPRICEZ_KEY
  if (gpzKey) {
    try {
      const res = await fetch(`https://goldpricez.com/api/rates/currency/${currency.toLowerCase()}/measure/gram`, {
        signal: AbortSignal.timeout(6000),
        headers: { 'X-API-KEY': gpzKey, 'user-agent': UA },
      })
      if (res.ok) {
        const g24 = parseGoldpricezGram24k(await res.json())
        if (g24) samples.push({ value: g24, source: 'goldpricez', upstream: 'goldpricez' })
      }
    } catch {
      /* provider down */
    }
  }

  const c = priceConsensus(samples, 0.005)
  if (c.value === null) return []
  const g24 = c.value
  const meta = { confidence: c.confidence, sources: c.sources.join(',') }
  return ([24, 21, 18] as GoldKarat[]).map((k) => ({
    karat: k,
    pricePerGram: g24 * goldPurityFactor(k),
    ...meta,
  }))
}

/** Distinct stock tickers held across all users — the only symbols worth spending a quote call on. */
export async function fetchHeldStockTickers(service: ServiceClient): Promise<string[]> {
  const { data } = await service
    .from('savings_holdings')
    .select('asset_symbol')
    .eq('asset_type', 'stock')
    .is('deleted_at', null)
  const set = new Set<string>()
  for (const r of data ?? []) {
    const s = (r.asset_symbol as string | null)?.trim().toUpperCase()
    if (s) set.add(s)
  }
  return [...set]
}

/** Finnhub quotes for the given tickers (USD). Skips halted/unknown (c === 0). */
export async function fetchFinnhubQuotes(tickers: string[], key: string): Promise<StockQuote[]> {
  const out: StockQuote[] = []
  for (const t of tickers) {
    try {
      const res = await fetch(finnhubQuoteUrl(t, key), { signal: AbortSignal.timeout(6000) })
      if (!res.ok) continue
      const q = parseFinnhubQuote(t, await res.json())
      if (q) out.push(q)
    } catch {
      /* skip this ticker */
    }
  }
  return out
}
