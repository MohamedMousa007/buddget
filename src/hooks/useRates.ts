'use client'

import { useEffect, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { fetchExchangeRates, RATES_TTL_MS } from '@/lib/market/marketData'
import { ratesNeedFetch } from '@/lib/market/rateFreshness'

export function useRates() {
  const exchangeRates = useFinanceStore((s) => s.exchangeRates)
  const lastRatesFetch = useFinanceStore((s) => s.lastRatesFetch)
  const fetchedAt = useFinanceStore((s) => s.rateFetchedAt)
  // False only while a fetch is in flight, so a missing-rate notice never flashes before the answer. Not tied to the
  // effect's lifetime: a successful fetch writes the store, which re-runs the effect before the promise settles.
  const [attempted, setAttempted] = useState(false)
  const [mountedAt] = useState(() => Date.now())
  const needsFetch = ratesNeedFetch(lastRatesFetch, fetchedAt ?? {}, mountedAt, RATES_TTL_MS)
  const settled = !needsFetch || attempted

  useEffect(() => {
    if (!ratesNeedFetch(lastRatesFetch, fetchedAt ?? {}, Date.now(), RATES_TTL_MS)) return
    void fetchExchangeRates().finally(() => setAttempted(true))
  }, [lastRatesFetch, fetchedAt])

  return { exchangeRates, lastRatesFetch, settled, refetch: fetchExchangeRates }
}
