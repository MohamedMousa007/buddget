import { createServiceRoleClient } from '@/lib/supabase/service'
import { coinGeckoUrl, parseCoinGeckoSimplePrice } from '@/lib/prices/coingecko'
import { fetchSpotOunceUsd, fetchOfficialUsdEgp, fetchEgyptSaghaHtml } from '@/lib/prices/fetchSpot'
import { resolveEgyptSaghaFromHtml } from '@/lib/prices/resolveEgyptSagha'
import { egyptKaratPrice, usdPerGram } from '@/lib/prices/egyptGold'
import { fetchGulfGoldKarats, fetchHeldStockTickers, fetchFinnhubQuotes } from '@/lib/prices/fetchKeyed'
import type { Currency, GoldKarat } from '@/lib/store/types'

/**
 * Computes the full asset_prices snapshot (gold spot, Egyptian karats via the consensus Sagha
 * dollar, crypto, Gulf karats, held stocks) and upserts it on (symbol, currency). Shared by the
 * scheduled cron (`/api/cron/prices`) and the lazy self-heal endpoint (`/api/prices/refresh`) so
 * the pipeline has one source of truth. Every write is idempotent — safe to run repeatedly.
 */
export type PriceRefreshResult = { ok: boolean; written: number; reason?: string; error?: string }

type PriceUpsert = {
  symbol: string
  asset_class: string
  currency: Currency
  price: number
  as_of: string
  source: string | null
  upstream: string | null
  confidence: string | null
  updated_at: string
}

const EGYPT_KARATS: GoldKarat[] = [24, 21, 18]

export async function runPriceRefresh(): Promise<PriceRefreshResult> {
  const now = new Date().toISOString()
  const rows: PriceUpsert[] = []
  const row = (o: Omit<PriceUpsert, 'as_of' | 'updated_at'>): PriceUpsert => ({ ...o, as_of: now, updated_at: now })

  const [ounceUsd, officialUsdEgp] = await Promise.all([fetchSpotOunceUsd(), fetchOfficialUsdEgp()])

  // Official USD/EGP — the client computes the local-vs-global gold premium against the SAME
  // official rate the Sagha dollar was measured against (not its own display FX rate).
  if (officialUsdEgp) {
    rows.push(row({ symbol: 'OFFICIAL_USD', asset_class: 'fx', currency: 'EGP', price: officialUsdEgp, source: 'open.er-api.com', upstream: 'er-api', confidence: 'single' }))
  }

  // Global gold spot (USD/oz and USD/g).
  if (ounceUsd) {
    rows.push(row({ symbol: 'XAU', asset_class: 'gold', currency: 'USD', price: ounceUsd, source: 'spot-consensus', upstream: 'spot', confidence: 'high' }))
    rows.push(row({ symbol: 'XAU_G', asset_class: 'gold', currency: 'USD', price: usdPerGram(ounceUsd), source: 'spot-consensus', upstream: 'spot', confidence: 'high' }))
  }

  // Egyptian local gold: consensus Sagha dollar → karat prices in EGP.
  if (ounceUsd && officialUsdEgp) {
    try {
      const htmls = await fetchEgyptSaghaHtml()
      const sagha = resolveEgyptSaghaFromHtml(htmls, { ounceUsd, officialUsdEgp })
      if (sagha.value !== null) {
        rows.push(row({ symbol: 'SAGHA_USD', asset_class: 'fx', currency: 'EGP', price: sagha.value, source: sagha.sources.join(','), upstream: String(sagha.upstreams), confidence: sagha.confidence }))
        for (const k of EGYPT_KARATS) {
          rows.push(row({ symbol: `XAU_${k}K`, asset_class: 'gold', currency: 'EGP', price: egyptKaratPrice(ounceUsd, sagha.value, k), source: sagha.sources.join(','), upstream: String(sagha.upstreams), confidence: sagha.confidence }))
        }
      }
    } catch (e) {
      console.error('[prices] egypt gold failed', e)
    }
  }

  // Crypto (CoinGecko, keyless).
  try {
    const res = await fetch(coinGeckoUrl(), { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      for (const r of parseCoinGeckoSimplePrice(await res.json())) {
        rows.push(row({ symbol: r.symbol, asset_class: 'crypto', currency: r.currency as Currency, price: r.price, source: 'coingecko', upstream: 'coingecko', confidence: 'single' }))
      }
    }
  } catch (e) {
    console.error('[prices] coingecko failed', e)
  }

  // Gulf gold karats (keyed): AED/SAR are pegged, so GoldAPI.io + goldpricez give exact local karat
  // prices with no crawling. EGP is deliberately excluded — its local price is the crawled Sagha.
  for (const cur of ['AED', 'SAR'] as const) {
    try {
      for (const k of await fetchGulfGoldKarats(cur)) {
        rows.push(row({ symbol: `XAU_${k.karat}K`, asset_class: 'gold', currency: cur, price: k.pricePerGram, source: k.sources, upstream: 'gulf-gold', confidence: k.confidence }))
      }
    } catch (e) {
      console.error(`[prices] gulf gold ${cur} failed`, e)
    }
  }

  // Stocks (keyed, Finnhub): only the tickers users actually hold — one quote call each.
  const finnhubKey = process.env.FINNHUB_KEY
  if (finnhubKey) {
    try {
      const service0 = createServiceRoleClient()
      const tickers = await fetchHeldStockTickers(service0)
      if (tickers.length > 0) {
        for (const q of await fetchFinnhubQuotes(tickers, finnhubKey)) {
          rows.push(row({ symbol: q.symbol, asset_class: 'stock', currency: 'USD', price: q.price, source: 'finnhub', upstream: 'finnhub', confidence: 'single' }))
        }
      }
    } catch (e) {
      console.error('[prices] finnhub failed', e)
    }
  }

  if (rows.length === 0) {
    return { ok: false, written: 0, reason: 'all providers failed' }
  }

  const service = createServiceRoleClient()
  const { error } = await service.from('asset_prices').upsert(rows, { onConflict: 'symbol,currency' })
  if (error) {
    console.error('[prices] upsert failed', error)
    return { ok: false, written: 0, error: error.message }
  }

  return { ok: true, written: rows.length }
}
