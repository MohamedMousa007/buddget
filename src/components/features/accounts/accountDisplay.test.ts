import { describe, expect, it } from 'vitest'
import { accountIdentifier, accountSubtitle, moneyFlex, sharesProvider } from './accountDisplay'

describe('accountIdentifier', () => {
  it('shows the label in place of the digits, and the digits when there is no label', () => {
    expect(accountIdentifier({ label: 'Salary', last4: '2016' })).toBe('Salary')
    expect(accountIdentifier({ last4: '2016' })).toBe('•• 2016')
    expect(accountIdentifier({ label: '  ', last4: '2016' })).toBe('•• 2016')
  })
  it('shows nothing when the account has neither', () => {
    expect(accountIdentifier({})).toBeNull()
  })
})

describe('same-provider accounts', () => {
  const hsbcUsd = { id: 'a', name: 'HSBC ••1234', last4: '1234', currency: 'USD' } as never
  const hsbcEgp = { id: 'b', name: 'HSBC ••5678', last4: '5678', currency: 'EGP' } as never
  const cib = { id: 'c', name: 'CIB', currency: 'EGP' } as never
  it('only a shared provider puts the currency in the subtitle', () => {
    expect(sharesProvider(hsbcUsd, [hsbcUsd, hsbcEgp, cib])).toBe(true)
    expect(sharesProvider(cib, [hsbcUsd, hsbcEgp, cib])).toBe(false)
    expect(accountSubtitle({ last4: '1234', currency: 'USD' } as never, true)).toBe('USD · •• 1234')
    expect(accountSubtitle({ last4: '1234', currency: 'USD' } as never, false)).toBe('•• 1234')
  })
  it('keeps the digits beside a custom label when shared', () => {
    expect(accountSubtitle({ label: 'Salary', last4: '1234', currency: 'USD' } as never, true)).toBe('USD · Salary · •• 1234')
  })
})

describe('moneyFlex (QA-121)', () => {
  it('keeps decimals when the value is not whole, so -15,219.99 never prints as -15,219', () => {
    expect(moneyFlex(-15219.99, 'EGP')).toBe('−15,219.99')
    expect(moneyFlex(1500, 'EGP')).toBe('1,500')
    expect(moneyFlex(1499.996, 'EGP')).toBe('1,500')
  })
})
