import { describe, expect, it } from 'vitest'
import { BLANK_DEBT_DRAFT, debtDraftDirty, debtDraftMissing, draftOfDebt } from '@/lib/debts/debtDraft'
import type { Debt } from '@/lib/store/types'

describe('debt sheet draft', () => {
  it('a blank add sheet is not dirty; any typed field is', () => {
    expect(debtDraftDirty(BLANK_DEBT_DRAFT, BLANK_DEBT_DRAFT)).toBe(false)
    expect(debtDraftDirty({ ...BLANK_DEBT_DRAFT, amount: '500' }, BLANK_DEBT_DRAFT)).toBe(true)
    expect(debtDraftDirty({ ...BLANK_DEBT_DRAFT, person: 'Ahmed' }, BLANK_DEBT_DRAFT)).toBe(true)
    expect(debtDraftDirty({ ...BLANK_DEBT_DRAFT, person: '  ' }, BLANK_DEBT_DRAFT)).toBe(false)
  })

  it('an edit sheet is dirty only when it differs from the stored debt', () => {
    const d = { id: 'd', name: 'Rent', person: 'Ahmed', personName: 'Ahmed', startingBalance: 1500, debtType: 'personal' } as Debt
    const from = draftOfDebt(d)
    expect(debtDraftDirty({ ...from, amount: '1500.00' }, from)).toBe(false)
    expect(debtDraftDirty({ ...from, name: 'Car' }, from)).toBe(true)
  })

  it('For is optional; the amount and the person are what a borrow needs', () => {
    expect(debtDraftMissing('personal', { ...BLANK_DEBT_DRAFT, person: 'Ahmed' })).toBe('amount')
    expect(debtDraftMissing('personal', { ...BLANK_DEBT_DRAFT, amount: '500' })).toBe('person')
    expect(debtDraftMissing('personal', { ...BLANK_DEBT_DRAFT, amount: '500', person: 'Ahmed' })).toBeNull()
    expect(debtDraftMissing('installment', { ...BLANK_DEBT_DRAFT, amount: '500' })).toBe('item')
  })
})
