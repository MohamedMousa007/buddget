import { describe, it, expect } from 'vitest'
import { resolveCurrency } from './currencyResolver'
import type { ServiceClient } from '@/lib/supabase/service'

const service = (base: string | null) => ({
  from: (table: string) => {
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = () => chain
    chain.maybeSingle = async () => ({ data: table === 'profiles' ? { base_currency: base } : null })
    return chain
  },
}) as unknown as ServiceClient

const params = { userId: 'u', sender: null, rawBody: 'Purchase TRY 50 at X' }

describe('resolveCurrency', () => {
  it('trusts a supported literal', async () => {
    expect(await resolveCurrency(service('EGP'), { ...params, rawBody: 'Purchase USD 50 at X', parsedCurrency: 'usd' })).toEqual({ currency: 'USD', provisional: false })
  })
  it('unknown code falls back to base, provisional', async () => {
    expect(await resolveCurrency(service('SAR'), { ...params, parsedCurrency: 'TRY' })).toEqual({ currency: 'SAR', provisional: true })
  })
})
