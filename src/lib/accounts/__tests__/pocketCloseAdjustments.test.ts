import { describe, expect, it } from 'vitest'
import { pocketCloseAdjustments } from '../pocketCloseAdjustments'
import { computeBalances, type LedgerInput } from '../balance'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

const bank = { id: 'bank', name: 'bank', type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '', openingBalance: 1000, openingAt: '2026-10-01T00:00:00.000Z' } as PaymentMethod
const trip = { id: 'trip', name: 'Trip', currency: 'EGP', currentBalance: 0, heldInPaymentMethodId: 'bank' } as SavingsAccount
const spend = { id: 't', accountId: 'trip', type: 'withdrawal', amount: 100, currency: 'EGP', date: '2026-10-07', occurredAt: '2026-10-07T10:00:00.000Z' } as never
const ledger = (o: Partial<LedgerInput>): LedgerInput => ({
  paymentMethods: [bank], expenses: [], incomeEvents: [], debts: [], debtPayments: [], savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a) => a, ...o,
})
let n = 0
const id = () => `adj${n++}`

describe('pocketCloseAdjustments', () => {
  it('freezes the leg a deleted pocket took with it', () => {
    const before = ledger({ savingsAccounts: [trip], savingsTransactions: [spend] })
    const after = ledger({})
    const adj = pocketCloseAdjustments(before, after, 'Trip', '2026-11-20T00:00:00.000Z', id)
    expect(adj).toHaveLength(1)
    expect(adj[0]).toMatchObject({ paymentMethodId: 'bank', delta: -100, reason: 'manual_update', note: 'Pocket closed: Trip' })
    expect(computeBalances({ ...after, adjustments: adj }).get('bank')?.balance).toBe(900)
  })
  it('writes nothing when no balance changed', () => {
    const before = ledger({ savingsAccounts: [trip] })
    expect(pocketCloseAdjustments(before, ledger({}), 'Trip', '2026-11-20T00:00:00.000Z', id)).toEqual([])
  })
})
