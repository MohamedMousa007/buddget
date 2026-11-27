import { describe, expect, it } from 'vitest'
import { incomeSourceFromRow, incomeSourceToRow } from '@/lib/supabase/remote/mappers/incomeSourceMapper'
import type { IncomeSource } from '@/lib/store/types'

const base: IncomeSource = {
  id: 's', name: 'Side project', amount: 4000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 1,
  effectiveStart: '2026-07-01', createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', sourceType: 'other',
}
const roundTrip = (s: IncomeSource) => incomeSourceFromRow({ ...incomeSourceToRow(s, 'u'), deleted_at: null, updated_at: s.updatedAt } as never)

describe('income source mapper', () => {
  it('keeps irregular and the picked icon across a sync round trip, with the schedule left monthly', () => {
    const row = incomeSourceToRow({ ...base, irregular: true, icon: 'graduation-cap' }, 'u')
    expect(row).toMatchObject({ is_irregular: true, icon: 'graduation-cap', recurring_frequency: 'monthly' })
    expect(roundTrip({ ...base, irregular: true, icon: 'graduation-cap' })).toMatchObject({ irregular: true, icon: 'graduation-cap', recurringFrequency: 'monthly' })
  })

  it('writes a regular source as not irregular with no icon, and reads neither back', () => {
    expect(incomeSourceToRow(base, 'u')).toMatchObject({ is_irregular: false, icon: null })
    const back = roundTrip(base)
    expect(back.irregular).toBeUndefined()
    expect(back.icon).toBeUndefined()
  })
})
