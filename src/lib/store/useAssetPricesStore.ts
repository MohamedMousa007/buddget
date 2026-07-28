import { create } from 'zustand'
import type { AssetPriceMap } from '@/lib/prices/assetPriceLookup'

/**
 * Global (not user-scoped) live-price cache mirror. Populated from the asset_prices table by
 * useAssetPrices; read by every valuation surface via lookupAssetPrice. Kept out of the finance
 * store because it is shared market data, not the user's data.
 */
interface AssetPricesState {
  prices: AssetPriceMap
  lastFetch: string | null
  setPrices: (prices: AssetPriceMap) => void
}

export const useAssetPricesStore = create<AssetPricesState>((set) => ({
  prices: {},
  lastFetch: null,
  setPrices: (prices) => set({ prices, lastFetch: new Date().toISOString() }),
}))
