'use client'

import { useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAssetPricesStore } from '@/lib/store/useAssetPricesStore'
import {
  buildAssetPriceMap,
  lookupAssetPrice,
  type AssetPriceEntry,
  type LivePrice,
} from '@/lib/prices/assetPriceLookup'

const REFRESH_MS = 30 * 60 * 1000 // client re-reads the cache every 30 min (server refreshes it every 4h)

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

  return { prices, lookup }
}
