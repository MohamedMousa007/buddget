import { describe, expect, it } from 'vitest'
import { hasLegacyZakat, legacyZakatFigure, withoutLegacyZakat } from './zakatLegacy'
import type { ZakatBase } from './zakatInputs'

const base: ZakatBase = {
  cashAndSavings: 100_000, goldValue: 0, cryptoValue: 0, stocksValue: 0, receivables: 0, debtsDueThisYear: 0,
  gold24kSellPerGram: 6000, silverPerGram: 75, goldHoldings: [], wornGoldGrams: 0, receivableDebts: [],
  incomplete: false, noHistoryCount: 0,
}

describe('zakat legacy figures', () => {
  it('reports an old typed total as the old figure', () => {
    const cfg = { nisabBasis: 'silver', holdsForTrading: false, manualAmount: 1234 } as never
    expect(hasLegacyZakat(cfg)).toBe(true)
    expect(legacyZakatFigure(cfg, base)).toBe(1234)
  })
  it('rebuilds the old figure from line edits', () => {
    const cfg = { nisabBasis: 'silver', holdsForTrading: false, lineOverrides: { cash: 200_000 } } as never
    expect(legacyZakatFigure(cfg, base)).toBeCloseTo(5_000, 5)
  })
  it('has no note for a clean config', () => {
    const cfg = { nisabBasis: 'silver' as const, holdsForTrading: false }
    expect(hasLegacyZakat(cfg)).toBe(false)
    expect(legacyZakatFigure(cfg, base)).toBeNull()
  })
  it('dismissing strips the old fields and keeps the rest', () => {
    const cfg = { nisabBasis: 'gold', holdsForTrading: true, yearStartDate: '2026-01-01', manualAmount: 5, lineOverrides: { gold: 1 } } as never
    const out = withoutLegacyZakat(cfg)
    expect(out).toEqual({ nisabBasis: 'gold', holdsForTrading: true, yearStartDate: '2026-01-01' })
    expect('manualAmount' in out).toBe(false)
  })
})
