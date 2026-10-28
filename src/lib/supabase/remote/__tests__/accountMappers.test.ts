import { describe, expect, it } from 'vitest'
import type { PaymentMethod, UserProfile } from '@/lib/store/types'
import { paymentMethodFromRow, paymentMethodToRow } from '@/lib/supabase/remote/mappers/paymentMethodMapper'
import { profileToRow } from '@/lib/supabase/remote/mappers/profileMapper'

const pm = (o: Partial<PaymentMethod> = {}): PaymentMethod => ({ id: 'a', name: 'CIB ••2016', type: 'bank_account', currency: 'EGP', isDefault: false, last4: '2016', ...o })

describe('payment method label', () => {
  it('stores the label beside the digits and reads both back', () => {
    const row = paymentMethodToRow(pm({ label: ' Salary ' }), 'u1')
    expect(row).toMatchObject({ label: 'Salary', last4: '2016' })
    expect(paymentMethodFromRow({ ...row, created_at: null, updated_at: null, deleted_at: null } as never)).toMatchObject({ label: 'Salary', last4: '2016' })
  })
  it('stores no label when there is none', () => {
    expect(paymentMethodToRow(pm(), 'u1').label).toBeNull()
  })
  it('always checks accounts against bank messages', () => {
    expect(paymentMethodToRow(pm({ trackSms: false }), 'u1').track_sms).toBe(true)
    expect(paymentMethodFromRow({ ...paymentMethodToRow(pm(), 'u1'), track_sms: false } as never).trackSms).toBe(true)
  })
})

const EXTRAS = { financialGoalsNotes: '', activeBudgetPlanId: null, baseCurrency: 'EGP' as const }

describe('profile write', () => {
  const base = { id: 'p', name: 'A', createdAt: '2026-01-01' } as UserProfile
  it('does not send an empty zakat choice over the account’s saved one', () => {
    expect('zakat_config' in profileToRow(base, EXTRAS, 'u1')).toBe(false)
    expect(profileToRow({ ...base, zakatConfig: { holdsForTrading: false, nisabBasis: 'silver', nisabBasisChosen: true } }, EXTRAS, 'u1').zakat_config).toMatchObject({ nisabBasis: 'silver' })
  })
})
