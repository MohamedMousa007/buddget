'use client'

import { useEffect, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const TROY_OUNCE_TO_GRAMS = 31.1035

export function useGoldPrice() {
  const { goldPricePerGram, exchangeRates, updateGoldPrice } = useFinanceStore()

  const fetchGoldPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/gold')
      if (!res.ok) return

      const data = await res.json()
      if (data.pricePerGram) {
        updateGoldPrice(data.pricePerGram)
      }
    } catch {
      // Try direct metals.live API as fallback
      try {
        const res = await fetch('https://metals.live/api/spot')
        if (!res.ok) return

        const metals = await res.json()
        const gold = metals.find((m: { metal: string }) => m.metal === 'gold')
        if (gold) {
          const usdPerGram = gold.price / TROY_OUNCE_TO_GRAMS
          const usdToAed = exchangeRates['USD_AED'] || 3.6725
          updateGoldPrice(usdPerGram * usdToAed)
        }
      } catch {
        console.warn('Failed to fetch gold price, using cached value')
      }
    }
  }, [exchangeRates, updateGoldPrice])

  useEffect(() => {
    fetchGoldPrice()
    const interval = setInterval(fetchGoldPrice, 30 * 60 * 1000) // every 30 min
    return () => clearInterval(interval)
  }, [fetchGoldPrice])

  return { goldPricePerGram, refetch: fetchGoldPrice }
}
