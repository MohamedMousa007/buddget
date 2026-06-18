import { useFinanceStore } from '@/lib/store/useFinanceStore'

export const RATES_TTL_MS = 4 * 60 * 60 * 1000 // 4h
export const GOLD_TTL_MS = 15 * 60 * 1000 // 15min

/**
 * Fetch FX rates (and the gold price derived from the rates payload) and apply
 * them to the store. Plain async — usable outside React (e.g. the sync pull)
 * via `useFinanceStore.getState()`. Never throws; keeps cached values on error.
 */
export async function fetchExchangeRates(): Promise<void> {
  try {
    const { apiFetch } = await import('@/lib/apiBase')
    const res = await apiFetch('/api/rates')
    if (!res.ok) return
    const data = await res.json()
    if (data.rates && typeof data.rates === 'object') {
      useFinanceStore.getState().updateRates(data.rates as Record<string, number>)
    }
    if (
      data.gold &&
      typeof data.gold === 'object' &&
      typeof data.gold.pricePerGramUsd === 'number' &&
      data.gold.pricePerGramUsd > 0
    ) {
      const usdToAed = (data.rates?.['USD_AED'] as number) ?? 3.6725
      const aedPerGram = data.gold.pricePerGramUsd * usdToAed
      useFinanceStore.getState().updateGoldPrice(aedPerGram)
    }
  } catch (err) {
    console.warn('Failed to fetch exchange rates, using cached values', err)
  }
}

/** Fetch the authoritative spot gold price and apply to the store. Never throws. */
export async function fetchGoldPrice(): Promise<void> {
  const store = useFinanceStore.getState()
  try {
    const { apiFetch } = await import('@/lib/apiBase')
    const res = await apiFetch('/api/gold')
    if (!res.ok) return store.setGoldUnavailable()
    const data = await res.json()
    if (data.available === false) return store.setGoldUnavailable() // providers down
    if (data.pricePerGram) store.updateGoldPrice(data.pricePerGram)
  } catch {
    store.setGoldUnavailable()
  }
}

/**
 * Ensure FX rates + gold are fresh, fetching only what's stale (rates > 4h,
 * gold > 15min) in parallel. Called by `SupabaseFinanceSync.pull()` so market
 * data loads UNDER the loading splash — dashboard totals are final on first
 * paint, with no post-load currency/gold flicker.
 */
export async function ensureMarketDataFresh(): Promise<void> {
  const { lastRatesFetch, lastGoldFetch } = useFinanceStore.getState()
  const now = Date.now()
  const jobs: Promise<void>[] = []
  if (!lastRatesFetch || now - new Date(lastRatesFetch).getTime() > RATES_TTL_MS) {
    jobs.push(fetchExchangeRates())
  }
  if (!lastGoldFetch || now - new Date(lastGoldFetch).getTime() > GOLD_TTL_MS) {
    jobs.push(fetchGoldPrice())
  }
  if (jobs.length) await Promise.allSettled(jobs)
}
