import { describe, it, expect } from 'vitest'
import { receivingAccounts } from '@/lib/debts/receivingAccounts'
import type { PaymentMethod } from '@/lib/store/types'

const pm = (id: string, over: Partial<PaymentMethod>): PaymentMethod =>
  ({ id, name: 'X', type: 'bank_account', currency: 'EGP', isDefault: false, openingBalance: 0, openingAt: '2026-01-01T00:00:00Z', ...over }) as PaymentMethod

describe('receivingAccounts (QA W4 P1: Received-in list)', () => {
  const methods = [
    pm('vf', { name: 'Vodafone Cash', type: 'wallet', last4: '1234', createdAt: '2026-11-26' }),
    pm('vf2', { name: 'Vodafone Cash', type: 'wallet', last4: '1234', openingBalance: undefined, openingAt: undefined, createdAt: '2026-11-20' }),
    pm('qnb', { name: 'QNB' }),
    pm('nbe', { name: 'NBE', closedAt: '2026-11-01' }),
    pm('hsbc', { name: 'HSBC Egypt test', provisional: true }),
    pm('visa', { name: 'Visa', type: 'credit_card' }),
    pm('debit', { name: 'QNB Debit', type: 'debit_card', parentId: 'qnb' }),
    pm('cash-untracked', { name: 'Cash', type: 'cash', openingBalance: undefined, openingAt: undefined }),
  ]

  it('lists only the Accounts page rows, once each', () => {
    expect(receivingAccounts(methods).map((m) => m.id)).toEqual(['vf', 'qnb'])
  })

  it('a duplicate keeps the tracked row unless the other one is the current pick', () => {
    expect(receivingAccounts(methods, 'vf2').map((m) => m.id)).toEqual(['vf2', 'qnb'])
  })
})
