'use client'

import { useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAssetPricesStore } from '@/lib/store/useAssetPricesStore'
import {
  buildAssetPriceMap,
  lookupAssetPrice,
  lookupAssetPriceDisplay,
  type AssetPriceEntry,
  type LivePrice,
  type DisplayPrice,
} from '@/lib/prices/assetPriceLookup'

const REFRESH_MS = 30 * 60 * 1000 // client re-reads the cache every 30 min (server refreshes it every 4h)
// If the freshest cached row is older than this, ask the server to self-heal (cron may be down).
const SELF_HEAL_MS = 6 * 60 * 60 * 1000 // 6h — the tightest freshness window

/**
 * Loads the shared asset_prices cache and exposes a fail-closed lookup. Clients read this table;
 * they never call price providers (rate limits, F8).
 */
export function useAssetPrices() {
  const prices = useAssetPricesStore((s) => s.prices)
  const lastFetch = useAssetPricesStore((s) => s.lastFetch)
  const setPrices = useAssetPricesStore((s) => s.setPrices)

  useEffect(() => {
    const stale = !lastFetch || Date.now() - new Date(lastFetch).getTime() > REFRESH_MS
    if (!stale) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('asset_prices')
          .select('symbol, currency, price, as_of, asset_class, confidence')
        if (cancelled || !data) return
        const rows: AssetPriceEntry[] = data.map((r) => ({
          symbol: r.symbol as string,
          currency: r.currency as string,
          price: Number(r.price),
          asOf: r.as_of as string,
          assetClass: r.asset_class as string,
          confidence: (r.confidence as string | null) ?? null,
        }))
        setPrices(buildAssetPriceMap(rows))

        // Self-heal: if ANY row is stale (scheduled cron may have quietly stopped updating just
        // that symbol, e.g. gold's provider going down while crypto/FX keep refreshing), ask the
        // server to refresh, then re-read once. Checking the OLDEST row (not the newest) is what
        // catches a single stuck asset class instead of only a fully-dead cron. The endpoint is
        // globally debounced, so this is cheap.
        const oldest = rows.reduce((m, r) => Math.min(m, Date.parse(r.asOf) || 0), Infinity)
        if (!Number.isFinite(oldest) || Date.now() - oldest > SELF_HEAL_MS) {
          try {
            const res = await fetch('/api/prices/refresh', { method: 'POST' })
            const body = (await res.json().catch(() => null)) as { written?: number } | null
            if (!cancelled && body && (body.written ?? 0) > 0) {
              const { data: fresh } = await supabase
                .from('asset_prices')
                .select('symbol, currency, price, as_of, asset_class, confidence')
              if (!cancelled && fresh) {
                setPrices(buildAssetPriceMap(fresh.map((r) => ({
                  symbol: r.symbol as string, currency: r.currency as string, price: Number(r.price),
                  asOf: r.as_of as string, assetClass: r.asset_class as string,
                  confidence: (r.confidence as string | null) ?? null,
                }))))
              }
            }
          } catch { /* offline / endpoint down — keep the cached rows we already have */ }
        }
      } catch (e) {
        if (!cancelled) console.error('[useAssetPrices]', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lastFetch, setPrices])

  const lookup = useCallback(
    (symbol: string, currency: string): LivePrice | null => lookupAssetPrice(prices, symbol, currency),
    [prices],
  )

  const lookupDisplay = useCallback(
    (symbol: string, currency: string): DisplayPrice | null => lookupAssetPriceDisplay(prices, symbol, currency),
    [prices],
  )

  return { prices, lookup, lookupDisplay }
}
