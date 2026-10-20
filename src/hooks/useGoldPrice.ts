'use client'

import { useEffect, useRef } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { fetchGoldPrice, GOLD_TTL_MS } from '@/lib/market/marketData'

export function useGoldPrice() {
  const goldPricePerGram = useFinanceStore((s) => s.goldPricePerGram)
  const goldPriceAvailable = useFinanceStore((s) => s.goldPriceAvailable)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)

  // The refresh timer is created once; it re-reads the store's last fetch time each tick instead of being rebuilt
  // every time a fetch lands (which also made every fetch restart the clock).
  useEffect(() => {
    const stale = () => {
      const last = useFinanceStore.getState().lastGoldFetch
      return !last || Date.now() - new Date(last).getTime() > GOLD_TTL_MS
    }
    if (stale()) void fetchGoldPrice()
    const interval = setInterval(() => { if (stale()) void fetchGoldPrice() }, GOLD_TTL_MS)
    return () => clearInterval(interval)
  }, [])

  // The stored price is denominated in the base currency; re-fetch to re-denominate when the user switches it
  // (not on mount: the effect above already covers that).
  const firstCurrency = useRef(true)
  useEffect(() => {
    if (firstCurrency.current) {
      firstCurrency.current = false
      return
    }
    void fetchGoldPrice()
  }, [baseCurrency])

  return {
    goldPricePerGram,
    goldPriceAvailable: goldPriceAvailable !== false, // default true for backwards compat
    refetch: fetchGoldPrice,
  }
}
