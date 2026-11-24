import { describe, expect, it } from 'vitest'
import { eligibleLegAccountIds, defaultLegAccountId, depositSourceIds, defaultDepositSourceId } from '@/lib/savings/legChoices'
import type { PaymentMethod } from '@/lib/store/types'

const pm = (id: string, over: Partial<PaymentMethod> = {}) =>
  ({ id, type: 'bank_account', name: id, currency: 'EGP', openingBalance: 0, openingAt: '2026-01-01', createdAt: `2026-01-0${id.length}`, ...over }) as unknown as PaymentMethod

describe('leg choices', () => {
  const methods = [pm('a'), pm('bb'), pm('usd', { currency: 'USD' }), pm('untracked', { openingBalance: undefined, openingAt: undefined })]

  it('offers only tracked same-currency accounts that do not hold the pocket', () => {
    expect(eligibleLegAccountIds(methods, { heldInPaymentMethodId: 'a' }, 'EGP')).toEqual(['bb'])
    expect(eligibleLegAccountIds(methods, {}, 'USD')).toEqual(['usd'])
  })

  it('defaults to the primary account, else the first eligible, else none', () => {
    expect(defaultLegAccountId(methods, {}, 'EGP')).toBe('a')
    expect(defaultLegAccountId(methods, { heldInPaymentMethodId: 'a' }, 'EGP')).toBe('bb')
    expect(defaultLegAccountId([], {}, 'EGP')).toBeUndefined()
  })

  it('Add money into a pocket held in an account: the holder comes first and is the default source (L1-A)', () => {
    expect(depositSourceIds(methods, { heldInPaymentMethodId: 'bb' }, 'EGP')).toEqual(['bb', 'a'])
    expect(defaultDepositSourceId(methods, { heldInPaymentMethodId: 'bb' }, 'EGP')).toBe('bb')
  })

  it('a pocket outside the accounts, or held in an untracked or closed one, keeps the usual sources', () => {
    expect(depositSourceIds(methods, {}, 'EGP')).toEqual(['a', 'bb'])
    expect(defaultDepositSourceId(methods, {}, 'EGP')).toBe('a')
    expect(defaultDepositSourceId(methods, { heldInPaymentMethodId: 'untracked' }, 'EGP')).toBe('a')
    const closed = [pm('a'), pm('bb', { closedAt: '2026-02-01' })]
    expect(depositSourceIds(closed, { heldInPaymentMethodId: 'bb' }, 'EGP')).toEqual(['a'])
  })
})
