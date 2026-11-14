import { describe, expect, it } from 'vitest'
import { incomeEventFromRow, incomeEventToRow } from './incomeEventMapper'
import type { IncomeEvent } from '@/lib/store/types'
import type { IncomeEventRow } from '@/lib/supabase/remote/types'

const base: IncomeEvent = {
  id: 'i1', name: 'Credit', amount: 100, currency: 'EGP', sourceType: 'other', receivedDate: '2026-11-05', status: 'confirmed',
  createdAt: '2026-11-05', updatedAt: '2026-11-05',
}

describe('server-stamped SMS flags (I8)', () => {
  it('never writes sms_flags, writes only the acknowledged list, and reads both', () => {
    const row = incomeEventToRow({ ...base, smsFlags: ['date_unsure'], smsFlagsAck: ['date_unsure'] }, 'u1')
    expect('sms_flags' in row).toBe(false)
    expect(row.sms_flags_ack).toEqual(['date_unsure'])
    expect(incomeEventToRow(base, 'u1').sms_flags_ack).toBeNull()
    const read = incomeEventFromRow({ ...row, deleted_at: null, updated_at: 'x', sms_flags: ['date_unsure', 'cash_deposit'] } as unknown as IncomeEventRow)
    expect(read.smsFlags).toEqual(['date_unsure', 'cash_deposit'])
    expect(read.smsFlagsAck).toEqual(['date_unsure'])
    expect(incomeEventFromRow({ ...row, sms_flags: null, sms_flags_ack: null } as unknown as IncomeEventRow).smsFlags).toBeUndefined()
  })
})
