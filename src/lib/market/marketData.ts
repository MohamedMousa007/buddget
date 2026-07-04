import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { tryConvertCurrency } from '@/lib/utils/currency'

export const RATES_TTL_MS = 4 * 60 * 60 * 1000 // 4h
export const GOLD_TTL_MS = 15 * 60 * 1000 // 15min

/**
 * Convert a USD-per-gram gold spot into the user's base currency using the
 * live FX rates in the store. Returns null when no USD→base path exists yet
 * (rates not loaded) so callers can avoid storing a wrong-currency figure.
 */
function goldUsdToBase(usdPerGram: number): number | null {
  const { settings, exchangeRates } = useFinanceStore.getState()
  return tryConvertCurrency(usdPerGram, 'USD', settings.baseCurrency, exchangeRates)
}

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
      // Rates were just applied above, so USD→base is now resolvable.
      const basePerGram = goldUsdToBase(data.gold.pricePerGramUsd)
      if (basePerGram && basePerGram > 0) {
        useFinanceStore.getState().updateGoldPrice(basePerGram)
      }
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
    if (typeof data.usdPerGram !== 'number' || data.usdPerGram <= 0) {
      return store.setGoldUnavailable()
    }
    // Base FX may be missing on first paint (rates fetched in parallel); resolve
    // rates first so we never store a USD figure labeled as the base currency.
    let basePerGram = goldUsdToBase(data.usdPerGram)
    if (basePerGram === null) {
      await fetchExchangeRates()
      basePerGram = goldUsdToBase(data.usdPerGram)
    }
    if (basePerGram && basePerGram > 0) store.updateGoldPrice(basePerGram)
    else store.setGoldUnavailable()
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
