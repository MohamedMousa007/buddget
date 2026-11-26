import { describe, expect, it } from 'vitest'
import { en } from '@/lib/i18n/dictionaries/en'
import type { SavingsAccount } from '@/lib/store/types'
import { pocketIdentity } from './pocketIdentity'

const p = (x: Partial<SavingsAccount>) => ({ id: 'p', name: 'Pocket', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 0, createdAt: '', ...x }) as SavingsAccount
const id = (x: Partial<SavingsAccount>) => pocketIdentity(p(x), en.savingsForms.identity)

describe('pocket sub-line never repeats the name or the last 4 (live QA: "HSBC Egypt" twice)', () => {
  it('drops a bank name that is already the pocket name and says the type instead', () => {
    expect(id({ name: 'HSBC Egypt', institution: 'HSBC Egypt' })).toBe('Bank account')
    expect(id({ name: 'Rainy day', institution: 'CIB' })).toBe('CIB · Bank account')
  })
  it('is empty when there is nothing beyond the name, never the name again', () => {
    expect(id({ name: 'Monthly Savings', type: 'cash' })).toBe('')
  })
  it('shows the last 4 once: not when the name already carries them', () => {
    expect(id({ name: 'QNB Alahli ••1231', accountLast4: '1231' })).toBe('Bank account')
    expect(id({ name: 'Trip', accountLast4: '1231' })).toBe('Bank account ••••1231')
  })
})
