import { describe, expect, it } from 'vitest'
import { incomeDestination } from '@/lib/savings/withdrawDestination'
import { defaultLegAccountId } from '@/lib/savings/legChoices'
import type { PaymentMethod } from '@/lib/store/types'

const pm = (id: string): PaymentMethod =>
  ({ id, type: 'bank_account', name: id, currency: 'EGP', openingBalance: 0, openingAt: '2026-01-01', createdAt: `2026-01-0${id.length}` }) as unknown as PaymentMethod

describe('incomeDestination', () => {
  it('a held pocket stays in its holder until an account is picked', () => {
    expect(incomeDestination({ heldInPaymentMethodId: 'a' }, null, 'bb')).toBeNull()
    expect(incomeDestination({ heldInPaymentMethodId: 'a' }, 'bb', 'bb')).toBe('bb')
  })
  it('a standalone pocket uses the picked account, else the default', () => {
    expect(incomeDestination({}, null, 'a')).toBe('a')
    expect(incomeDestination({}, 'bb', 'a')).toBe('bb')
    expect(incomeDestination(undefined, null, null)).toBeNull()
  })
  it('the deposit default is untouched: it still names the primary account for a pocket held elsewhere', () => {
    expect(defaultLegAccountId([pm('a'), pm('bb')], { heldInPaymentMethodId: 'bb' }, 'EGP')).toBe('a')
  })
})
