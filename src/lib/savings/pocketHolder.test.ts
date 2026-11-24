import { describe, expect, it } from 'vitest'
import { linkedPocketCurrency, pocketHolderId } from './pocketHolder'
import type { PaymentMethod } from '@/lib/store/types'

const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2020-01-01', openingBalance: 100, openingAt: '2020-01-01T00:00:00.000Z', ...over }) as PaymentMethod

describe('a pocket created from an account', () => {
  const methods = [pm('cib'), pm('card', { type: 'debit_card', parentId: 'cib', currency: 'USD', openingBalance: undefined, openingAt: undefined })]

  it('takes the currency of the account the money sits in, so it is always held there', () => {
    expect(linkedPocketCurrency(methods[0], methods)).toBe('EGP')
    expect(pocketHolderId(methods[0], methods, linkedPocketCurrency(methods[0], methods))).toBe('cib')
  })

  it('a debit card in another currency still resolves to its parent account and that account\'s currency', () => {
    expect(linkedPocketCurrency(methods[1], methods)).toBe('EGP')
    expect(pocketHolderId(methods[1], methods, linkedPocketCurrency(methods[1], methods))).toBe('cib')
  })

  it('another currency would have dropped the holder (the double count the lock prevents)', () => {
    expect(pocketHolderId(methods[0], methods, 'USD')).toBeUndefined()
  })
})
