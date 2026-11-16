import { beforeEach, describe, expect, it, vi } from 'vitest'

const row = vi.hoisted(() => ({ value: null as unknown, fail: false }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { if (row.fail) throw new Error('down'); return { data: row.value === null ? null : { value: row.value } } } }) }) }) }),
}))
import { DEFAULT_GROUNDED_SEARCH_MICRO, groundedSearchCostMicro, resetPricingCache } from './pricing'

beforeEach(() => { resetPricingCache(); row.value = null; row.fail = false })

describe('groundedSearchCostMicro', () => {
  it('reads the platform setting and caches it', async () => {
    row.value = { groundedSearchUsdMicro: 20000 }
    expect(await groundedSearchCostMicro()).toBe(20000)
    row.value = { groundedSearchUsdMicro: 1 }
    expect(await groundedSearchCostMicro()).toBe(20000)
  })
  it('falls back to the default when the setting is missing, invalid or unreachable', async () => {
    expect(await groundedSearchCostMicro()).toBe(DEFAULT_GROUNDED_SEARCH_MICRO)
    resetPricingCache(); row.value = { groundedSearchUsdMicro: -5 }
    expect(await groundedSearchCostMicro()).toBe(DEFAULT_GROUNDED_SEARCH_MICRO)
    resetPricingCache(); row.fail = true
    expect(await groundedSearchCostMicro()).toBe(DEFAULT_GROUNDED_SEARCH_MICRO)
  })
})
