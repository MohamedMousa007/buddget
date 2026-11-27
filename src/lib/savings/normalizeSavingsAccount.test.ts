import { describe, expect, it } from 'vitest'
import { normalizeSavingsAccountRow } from './normalizeSavingsAccount'

describe('normalizeSavingsAccountRow keeps fields it does not coerce', () => {
  it('keeps the home account, colour and term details through a restore', () => {
    const out = normalizeSavingsAccountRow({
      id: 's1', name: 'Trip', type: 'cash', category: 'savings', currency: 'EGP', currentBalance: '2000',
      createdAt: '2026-11-01T00:00:00Z', heldInPaymentMethodId: 'pm1', color: '#123456', isEmergencyCover: true,
      institution: 'CIB', accountLast4: '1234', maturityDate: '2027-01-01', yearlyReturn: 22, updatedAt: '2026-11-02T00:00:00Z',
      autoSave: { amount: 5 },
    })
    expect(out).toMatchObject({
      currentBalance: 2000, heldInPaymentMethodId: 'pm1', color: '#123456', isEmergencyCover: true, institution: 'CIB',
      accountLast4: '1234', maturityDate: '2027-01-01', yearlyReturn: 22, updatedAt: '2026-11-02T00:00:00Z',
    })
    expect(out).not.toHaveProperty('autoSave')
  })
  it('still coerces legacy rows', () => {
    const out = normalizeSavingsAccountRow({ id: 1, type: 'crypto_stable', currentBalance: 'x' })
    expect(out).toMatchObject({ id: '1', name: 'Savings', type: 'stablecoin', currentBalance: 0, currency: 'USD' })
  })
})
