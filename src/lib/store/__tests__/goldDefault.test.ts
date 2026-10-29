import { describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

describe('gold price after a reset', () => {
  it('carries no placeholder price and is marked unavailable', () => {
    useFinanceStore.setState({ goldPricePerGram: 3200, goldPriceAvailable: true })
    useFinanceStore.getState().resetAllData()
    const s = useFinanceStore.getState()
    expect(s.goldPricePerGram).toBe(0)
    expect(s.goldPriceAvailable).toBe(false)
  })
})
