import { describe, expect, it } from 'vitest'
import { expenseFromRow, expenseToRow } from './expenseMapper'
import type { Expense } from '@/lib/store/types'
import type { ExpenseRow } from '@/lib/supabase/remote/types'

const base: Expense = {
  id: 'e1', date: '2026-11-05', description: 'Fridge', category: 'Shopping', amount: 100, currency: 'EGP', amountInBaseCurrency: 100,
  paymentMethodId: 'pm_default_cash', isRecurring: false, createdAt: '2026-11-05', updatedAt: '2026-11-05',
}

describe('savings funding link on an expense (WLT1)', () => {
  it('round-trips the withdrawal id and reads NULL as none', () => {
    const row = { ...expenseToRow({ ...base, fundedFromSavingsTxId: 'tx-1' }, 'u1'), deleted_at: null, updated_at: 'x' } as unknown as ExpenseRow
    expect(row.funded_from_savings_tx_id).toBe('tx-1')
    expect(expenseFromRow(row).fundedFromSavingsTxId).toBe('tx-1')
    expect(expenseFromRow({ ...row, funded_from_savings_tx_id: null }).fundedFromSavingsTxId).toBeUndefined()
    expect(expenseToRow(base, 'u1').funded_from_savings_tx_id).toBeNull()
  })
})

describe('server-stamped SMS flags (I8)', () => {
  it('never writes sms_flags, writes only the acknowledged list, and reads both', () => {
    const row = expenseToRow({ ...base, smsFlags: ['date_unsure'], smsFlagsAck: ['date_unsure'] }, 'u1')
    expect('sms_flags' in row).toBe(false)
    expect(row.sms_flags_ack).toEqual(['date_unsure'])
    expect(expenseToRow(base, 'u1').sms_flags_ack).toBeNull()
    const read = expenseFromRow({ ...row, deleted_at: null, updated_at: 'x', sms_flags: ['date_unsure', 'cash_deposit'] } as unknown as ExpenseRow)
    expect(read.smsFlags).toEqual(['date_unsure', 'cash_deposit'])
    expect(read.smsFlagsAck).toEqual(['date_unsure'])
    expect(expenseFromRow({ ...row, sms_flags: null, sms_flags_ack: null } as unknown as ExpenseRow).smsFlags).toBeUndefined()
  })
})
