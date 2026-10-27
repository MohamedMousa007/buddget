import { useMemo } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { GoldQuote } from '@/lib/utils/currency'

/** The persisted gold spot (base currency per gram) as the quote that gold-aware conversions take. */
export function useGoldQuote(): GoldQuote {
  const pricePerGram = useFinanceStore((s) => s.goldPricePerGram)
  const available = useFinanceStore((s) => s.goldPriceAvailable) !== false
  return useMemo(() => ({ pricePerGram, available }), [pricePerGram, available])
}
