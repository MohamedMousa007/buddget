import { describe, it, expect } from 'vitest'
import { pickDefaultSavingsCurrency } from './savingsCurrencyOptions'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'

const withBase = (baseCurrency: 'EGP' | 'USD') => ({ ...DEFAULT_SETTINGS, baseCurrency })

describe('pickDefaultSavingsCurrency', () => {
  it('prefers the base currency for fiat types', () => {
    expect(pickDefaultSavingsCurrency(withBase('EGP'), 'bank')).toBe('EGP')
    expect(pickDefaultSavingsCurrency(withBase('USD'), 'bank')).toBe('USD')
  })
  it('keeps asset-unit types on their own unit (gold grams, stablecoin)', () => {
    expect(pickDefaultSavingsCurrency(withBase('EGP'), 'gold')).toBe('XAU')
    expect(pickDefaultSavingsCurrency(withBase('USD'), 'stablecoin')).toBe('USDT')
  })
})
