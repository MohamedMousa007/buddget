/**
 * GET /api/cron/prices  (Vercel Cron, hourly)
 *
 * Refreshes the shared asset_prices cache: global gold spot, Egyptian karat prices (via the
 * consensus Sagha dollar crawled from keyless sources), and crypto (CoinGecko). Clients read
 * this table; they never call providers themselves (free-tier rate limits, F8). Every write is
 * an upsert on (symbol, currency), so running repeatedly is safe.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { coinGeckoUrl, parseCoinGeckoSimplePrice } from '@/lib/prices/coingecko'
import { fetchSpotOunceUsd, fetchOfficialUsdEgp, fetchEgyptSaghaHtml } from '@/lib/prices/fetchSpot'
import { resolveEgyptSaghaFromHtml } from '@/lib/prices/resolveEgyptSagha'
import { egyptKaratPrice, usdPerGram } from '@/lib/prices/egyptGold'
import type { Currency, GoldKarat } from '@/lib/store/types'

export const maxDuration = 60

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

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()
  const rows: PriceUpsert[] = []
  const row = (o: Omit<PriceUpsert, 'as_of' | 'updated_at'>): PriceUpsert => ({ ...o, as_of: now, updated_at: now })

  const [ounceUsd, officialUsdEgp] = await Promise.all([fetchSpotOunceUsd(), fetchOfficialUsdEgp()])

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
      console.error('[cron/prices] egypt gold failed', e)
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
    console.error('[cron/prices] coingecko failed', e)
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, reason: 'all providers failed', written: 0 }, { status: 200 })
  }

  const service = createServiceRoleClient()
  const { error } = await service.from('asset_prices').upsert(rows, { onConflict: 'symbol,currency' })
  if (error) {
    console.error('[cron/prices] upsert failed', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, written: rows.length, ounceUsd, officialUsdEgp })
}
