'use client'

import { useEffect, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const FIFTEEN_MINUTES = 15 * 60 * 1000

export function useGoldPrice() {
  const goldPricePerGram = useFinanceStore((s) => s.goldPricePerGram)
  const goldPriceAvailable = useFinanceStore((s) => s.goldPriceAvailable)
  const lastGoldFetch = useFinanceStore((s) => s.lastGoldFetch)
  const updateGoldPrice = useFinanceStore((s) => s.updateGoldPrice)
  const setGoldUnavailable = useFinanceStore((s) => s.setGoldUnavailable)

  const fetchGoldPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/gold')
      if (!res.ok) {
        setGoldUnavailable()
        return
      }

      const data = await res.json()

      if (data.available === false) {
        // API is up but gold providers are all down
        setGoldUnavailable()
        return
      }

      if (data.pricePerGram) {
        updateGoldPrice(data.pricePerGram)
      }
    } catch {
      setGoldUnavailable()
    }
  }, [updateGoldPrice, setGoldUnavailable])

  useEffect(() => {
    const shouldFetch =
      !lastGoldFetch ||
      Date.now() - new Date(lastGoldFetch).getTime() > FIFTEEN_MINUTES

    if (shouldFetch) {
      fetchGoldPrice()
    }

    const interval = setInterval(fetchGoldPrice, FIFTEEN_MINUTES)
    return () => clearInterval(interval)
  }, [lastGoldFetch, fetchGoldPrice])

  return {
    goldPricePerGram,
    goldPriceAvailable: goldPriceAvailable !== false, // default true for backwards compat
    refetch: fetchGoldPrice,
  }
}
