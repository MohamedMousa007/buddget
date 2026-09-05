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

const REFRESH_MS = 30 * 60 * 1000 // passive re-read while the app stays open (server refreshes daily)
// If the freshest cached row is older than this, ask the server to self-heal (cron may be down).
const SELF_HEAL_MS = 6 * 60 * 60 * 1000 // 6h — the tightest freshness window

/**
 * Re-reads the shared asset_prices table into the store, self-healing if every row looks stuck.
 * A plain module function (not tied to a component) so pull-to-refresh — same shape as
 * `syncFinanceNow` — and the app-resume listener can both force a real refetch on demand, not
 * just whichever component happens to have `useAssetPrices` mounted.
 */
export async function refreshAssetPrices(): Promise<void> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('asset_prices')
      .select('symbol, currency, price, as_of, asset_class, confidence')
    if (!data) return
    const rows: AssetPriceEntry[] = data.map((r) => ({
      symbol: r.symbol as string,
      currency: r.currency as string,
      price: Number(r.price),
      asOf: r.as_of as string,
      assetClass: r.asset_class as string,
      confidence: (r.confidence as string | null) ?? null,
    }))
    useAssetPricesStore.getState().setPrices(buildAssetPriceMap(rows))

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
        if (body && (body.written ?? 0) > 0) {
          const { data: fresh } = await supabase
            .from('asset_prices')
            .select('symbol, currency, price, as_of, asset_class, confidence')
          if (fresh) {
            useAssetPricesStore.getState().setPrices(buildAssetPriceMap(fresh.map((r) => ({
              symbol: r.symbol as string, currency: r.currency as string, price: Number(r.price),
              asOf: r.as_of as string, assetClass: r.asset_class as string,
              confidence: (r.confidence as string | null) ?? null,
            }))))
          }
        }
      } catch { /* offline / endpoint down — keep the cached rows we already have */ }
    }
  } catch (e) {
    console.error('[useAssetPrices]', e)
  }
}

/**
 * Loads the shared asset_prices cache and exposes a fail-closed lookup. Clients read this table;
 * they never call price providers (rate limits, F8).
 */
export function useAssetPrices() {
  const prices = useAssetPricesStore((s) => s.prices)
  const lastFetch = useAssetPricesStore((s) => s.lastFetch)

  useEffect(() => {
    const stale = !lastFetch || Date.now() - new Date(lastFetch).getTime() > REFRESH_MS
    if (stale) void refreshAssetPrices()
  }, [lastFetch])

  // Resume: a backgrounded app/tab is often never actually killed, so the in-memory `lastFetch`
  // (and its 30-min gate) survives the whole time it was backgrounded — reopening would otherwise
  // show whatever was cached before backgrounding for up to 30 more minutes even though the
  // shared DB row has moved on. Force a real re-read on resume, bypassing that gate.
  useEffect(() => {
    const onShow = () => { void refreshAssetPrices() }
    const onVisibility = () => { if (document.visibilityState === 'visible') onShow() }
    document.addEventListener('visibilitychange', onVisibility)
    let removeAppStateListener: (() => void) | null = null
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) onShow()
        })
        removeAppStateListener = () => { void handle.remove() }
      } catch { /* web build without @capacitor/app — ignore */ }
    })()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      removeAppStateListener?.()
    }
  }, [])

  const lookup = useCallback(
    (symbol: string, currency: string): LivePrice | null => lookupAssetPrice(prices, symbol, currency),
    [prices],
  )

  const lookupDisplay = useCallback(
    (symbol: string, currency: string): DisplayPrice | null => lookupAssetPriceDisplay(prices, symbol, currency),
    [prices],
  )

  return { prices, lookup, lookupDisplay, refresh: refreshAssetPrices }
}
