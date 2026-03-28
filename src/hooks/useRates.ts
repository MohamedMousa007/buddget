'use client'

import { useEffect, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const FOUR_HOURS = 4 * 60 * 60 * 1000

export function useRates() {
  const { exchangeRates, lastRatesFetch, updateRates } = useFinanceStore()

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/rates')
      if (!res.ok) return

      const data = await res.json()
      if (data.rates && typeof data.rates === 'object') {
        updateRates(data.rates as Record<string, number>)
      }
    } catch (err) {
      console.warn('Failed to fetch exchange rates, using cached values', err)
    }
  }, [updateRates])

  useEffect(() => {
    const shouldFetch =
      !lastRatesFetch ||
      Date.now() - new Date(lastRatesFetch).getTime() > FOUR_HOURS

    if (shouldFetch) {
      fetchRates()
    }
  }, [lastRatesFetch, fetchRates])

  return { exchangeRates, lastRatesFetch, refetch: fetchRates }
}
