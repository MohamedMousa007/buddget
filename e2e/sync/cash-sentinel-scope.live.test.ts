import { randomUUID } from 'crypto'
import { writeFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { emptySnapshot, flushDiff, type Snapshot } from '@/lib/supabase/remote'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import type { SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { liveClient } from './liveClient'

/** SYNC-003: which other mappers forward the `pm_default_cash` sentinel into a uuid column. */
describe('Cash sentinel in other uuid columns', () => {
  it('pocket held in Cash and a deposit from Cash', async () => {
    const { client, userId } = await liveClient(process.env.QA_SYNC_EMAIL_1 ?? 'qa-sync-1@buddget-qa.test')
    const now = new Date().toISOString()
    const pocket = { id: randomUUID(), name: 'QA pocket', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 0, createdAt: now, updatedAt: now } as unknown as SavingsAccount
    const heldInCash = { ...pocket, id: randomUUID(), name: 'QA pocket in cash', heldInPaymentMethodId: DEFAULT_CASH_ID } as SavingsAccount
    const s1: Snapshot = { ...emptySnapshot(), savingsAccounts: [pocket, heldInCash] }
    const r1 = await flushDiff(client, userId, emptySnapshot(), s1)
    const deposit = { id: randomUUID(), accountId: pocket.id, type: 'deposit', amount: 50, currency: 'EGP', date: now.slice(0, 10), paymentMethodId: DEFAULT_CASH_ID, createdAt: now, updatedAt: now } as unknown as SavingsTransaction
    const r2 = await flushDiff(client, userId, s1, { ...s1, savingsTransactions: [deposit] })
    const out = { pocketFlush: { errors: r1.errors, parked: r1.parked, heldInCashId: heldInCash.id }, depositFlush: { errors: r2.errors, parked: r2.parked } }
    writeFileSync('e2e/sync/evidence/cash-sentinel-scope.json', JSON.stringify(out, null, 2))
    // QA-40 fixed: the Cash sentinel goes to the server as NULL, nothing is parked, both rows land.
    expect(r1.parked ?? []).toEqual([])
    expect(r2.parked ?? []).toEqual([])
    const a = await client.from('savings_accounts').select('id, held_in_payment_method_id').eq('id', heldInCash.id)
    const t = await client.from('savings_transactions').select('id, payment_method_id').eq('id', deposit.id)
    expect(a.data).toEqual([{ id: heldInCash.id, held_in_payment_method_id: null }])
    expect(t.data).toEqual([{ id: deposit.id, payment_method_id: null }])
  })
})
