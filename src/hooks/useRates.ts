'use client'

import { useEffect } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { fetchExchangeRates, RATES_TTL_MS } from '@/lib/market/marketData'

export function useRates() {
  const exchangeRates = useFinanceStore((s) => s.exchangeRates)
  const lastRatesFetch = useFinanceStore((s) => s.lastRatesFetch)

  useEffect(() => {
    const shouldFetch =
      !lastRatesFetch || Date.now() - new Date(lastRatesFetch).getTime() > RATES_TTL_MS
    if (shouldFetch) void fetchExchangeRates()
  }, [lastRatesFetch])

  return { exchangeRates, lastRatesFetch, refetch: fetchExchangeRates }
}
