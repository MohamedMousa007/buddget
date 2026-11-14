import { describe, expect, it } from 'vitest'
import { unregisteredWalletBrand } from './walletBrand'

describe('unregisteredWalletBrand (finding N9: a credit naming a wallet the user has not registered)', () => {
  const none = new Set<string>()
  it('names a catalogue wallet brand the user lacks', () => {
    expect(unregisteredWalletBrand('Money added to your Barq wallet: EGP 100', none)).toBe('barq')
    expect(unregisteredWalletBrand('You received EGP 50 from Telda', none)).toBe('telda')
  })
  it('is null when the user has that brand registered', () => {
    expect(unregisteredWalletBrand('Money added to your Barq wallet', new Set(['barq']))).toBeNull()
  })
  it('matches whole words only', () => {
    expect(unregisteredWalletBrand('Credit from Barqawi Trading', none)).toBeNull()
  })
  it('a brand you can also buy from or phone through is named only by its full name', () => {
    expect(unregisteredWalletBrand('Vodafone bill credit adjustment', none)).toBeNull()
    expect(unregisteredWalletBrand('Credit to your Vodafone Cash wallet', none)).toBe('vodafone')
  })
  it('pass-through brands and unrelated text never count', () => {
    expect(unregisteredWalletBrand('Received via InstaPay and Apple Pay', none)).toBeNull()
    expect(unregisteredWalletBrand('Salary credit EGP 9000', none)).toBeNull()
    expect(unregisteredWalletBrand(null, none)).toBeNull()
  })
})
