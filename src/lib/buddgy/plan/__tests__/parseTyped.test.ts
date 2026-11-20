import { describe, expect, it } from 'vitest'
import { NODE_BY_ID } from '@/lib/budget/flow/nodes'
import { budgetStudioCopyAr, budgetStudioCopyEn } from '@/lib/i18n/budgetPage/studioCopy'
import { parseTyped } from '../parseTyped'

const en = (id: string, text: string) => parseTyped(NODE_BY_ID.get(id)!, text, budgetStudioCopyEn.q[id])
const ar = (id: string, text: string) => parseTyped(NODE_BY_ID.get(id)!, text, budgetStudioCopyAr.q[id])

describe('a typed answer is read with no model call, per control', () => {
  it('amount: one number, with separators, k, Arabic digits; zero only where zero is allowed', () => {
    expect(en('income', '18,500')).toBe(18500)
    expect(en('income', 'about 18.5k a month')).toBe(18500)
    expect(ar('income', '١٨٥٠٠ جنيه')).toBe(18500)
    expect(en('rent', '0')).toBe(0)
    expect(en('income', '0')).toBeUndefined()
    expect(en('income', 'between 10 and 20 thousand')).toBeUndefined()
    expect(en('income', 'no idea')).toBeUndefined()
  })

  it('stepper: a whole number inside the question range', () => {
    expect(en('payday', 'the 25th')).toBe(25)
    expect(ar('payday', '٢٥')).toBe(25)
    expect(en('payday', '40')).toBeUndefined()
    expect(en('dependents', '0')).toBeUndefined()
    expect(en('dependents', '2 kids')).toBe(2)
  })

  it('slider: a number inside its bounds', () => {
    expect(en('partnerSharePct', '60%')).toBe(60)
    expect(en('partnerSharePct', '5')).toBeUndefined()
  })

  it('toggle and confirm: yes or no in English or Arabic', () => {
    expect(en('rentIncludesUtilities', 'Yes')).toBe(true)
    expect(en('rentIncludesUtilities', 'nope')).toBe(false)
    expect(ar('rentIncludesUtilities', 'أيوه')).toBe(true)
    expect(ar('rentIncludesUtilities', 'لا')).toBe(false)
    expect(en('confirmIncome', 'right')).toBe(true)
    expect(en('rentIncludesUtilities', 'sometimes')).toBeUndefined()
  })

  it('chips: by the option label, exact first, then one unique partial match', () => {
    expect(en('incomeType', 'Salary')).toBe('salary')
    expect(en('incomeType', 'freelance')).toBe('freelance')
    expect(en('incomeType', 'my own business')).toBe('business')
    expect(ar('incomeType', 'راتب')).toBe('salary')
    expect(en('housing', 'I rent')).toBe('rent')
    expect(en('incomeType', 'lottery')).toBeUndefined()
  })

  it('multi: several labels, every one must be recognised', () => {
    expect(en('debtKinds', 'Credit card and student loan')).toEqual(['card', 'student'])
    expect(en('debtKinds', 'credit card, buy now pay later')).toEqual(['card', 'bnpl'])
    expect(en('debtKinds', 'credit card and a boat')).toBeUndefined()
    expect(en('debtKinds', 'loan')).toEqual(['loan'])
  })
})
