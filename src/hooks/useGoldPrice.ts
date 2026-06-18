'use client'

import { useEffect } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { fetchGoldPrice, GOLD_TTL_MS } from '@/lib/market/marketData'

export function useGoldPrice() {
  const goldPricePerGram = useFinanceStore((s) => s.goldPricePerGram)
  const goldPriceAvailable = useFinanceStore((s) => s.goldPriceAvailable)
  const lastGoldFetch = useFinanceStore((s) => s.lastGoldFetch)

  useEffect(() => {
    const shouldFetch =
      !lastGoldFetch || Date.now() - new Date(lastGoldFetch).getTime() > GOLD_TTL_MS
    if (shouldFetch) void fetchGoldPrice()

    const interval = setInterval(() => void fetchGoldPrice(), GOLD_TTL_MS)
    return () => clearInterval(interval)
  }, [lastGoldFetch])

  return {
    goldPricePerGram,
    goldPriceAvailable: goldPriceAvailable !== false, // default true for backwards compat
    refetch: fetchGoldPrice,
  }
}
