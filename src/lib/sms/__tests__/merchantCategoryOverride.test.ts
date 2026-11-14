import { describe, it, expect, vi } from 'vitest'
import { resolveMerchantCategory, rememberMerchantCategory, uniquePrefixCategory } from '../merchantCategoryCache'
import type { ServiceClient } from '@/lib/supabase/service'

function fakeService(rows: Record<string, Record<string, unknown>>) {
  const queried: string[] = []
  const rpc = vi.fn(async () => ({ error: null }))
  const from = (table: string) => {
    const filters: Record<string, unknown> = {}
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => { filters[col] = val; return q },
      ilike: (col: string, val: unknown) => { if (!String(val).endsWith('%')) filters[col] = val; else filters.__prefix = true; return q },
      in: () => q,
      then: (r: (v: unknown) => unknown) => { queried.push(`${table}:prefix`); return r({ data: [] }) },
      not: () => q,
      neq: () => q,
      is: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => {
        queried.push(table)
        const hit = rows[table]
        const matches = hit && Object.entries(filters).every(([k, v]) => k === '__prefix' || hit[k] === undefined || hit[k] === v)
        return { data: matches ? { category: hit.category } : null }
      },
    }
    return q
  }
  return { service: { from, rpc } as unknown as ServiceClient, queried, rpc }
}

describe('resolveMerchantCategory with a per-user override', () => {
  it('prefers the user override over the shared memory', async () => {
    const { service, queried } = fakeService({
      merchant_category_overrides: { user_id: 'u1', merchant_key: 'zzshop', category: 'Health' },
      merchant_categories: { merchant_key: 'zzshop', category: 'Shopping' },
    })
    expect(await resolveMerchantCategory(service, 'ZZ Shop', 'u1')).toBe('Health')
    expect(queried).toEqual(['merchant_category_overrides'])
  })

  it('falls back to the shared memory when this user has no override', async () => {
    const { service, queried } = fakeService({ merchant_categories: { merchant_key: 'zzshop', category: 'Shopping' } })
    expect(await resolveMerchantCategory(service, 'ZZ Shop', 'u1')).toBe('Shopping')
    expect(queried).toEqual(['merchant_category_overrides', 'expenses', 'expenses:prefix', 'merchant_categories'])
  })

  it('answers a known Egypt / Saudi merchant from the dictionary, ahead of the shared memory', async () => {
    const { service, queried } = fakeService({ merchant_categories: { merchant_key: 'kazyon', category: 'Shopping' } })
    expect(await resolveMerchantCategory(service, 'Kazyon', 'u1')).toBe('Groceries')
    expect(queried).toEqual(['merchant_category_overrides'])
  })

  it('lets the user correction outrank the dictionary', async () => {
    const { service } = fakeService({ merchant_category_overrides: { user_id: 'u1', merchant_key: 'kazyon', category: 'Shopping' } })
    expect(await resolveMerchantCategory(service, 'Kazyon', 'u1')).toBe('Shopping')
  })

  it('files a merchant where this user filed it before, ahead of the shared memory', async () => {
    const { service, queried } = fakeService({
      expenses: { user_id: 'u1', description: 'ZZ Shop', category: 'Food' },
      merchant_categories: { merchant_key: 'zzshop', category: 'Shopping' },
    })
    expect(await resolveMerchantCategory(service, 'ZZ Shop', 'u1')).toBe('Food')
    expect(queried).toEqual(['merchant_category_overrides', 'expenses'])
  })

  it('never lets a non-spend override change a purchase category', async () => {
    const { service } = fakeService({ merchant_category_overrides: { user_id: 'u1', merchant_key: 'zzshop', category: 'Transfer' } })
    expect(await resolveMerchantCategory(service, 'ZZ Shop', 'u1')).toBeNull()
  })
})

describe('rememberMerchantCategory', () => {
  it('never writes a money-movement category to the shared table', async () => {
    const { service, rpc } = fakeService({})
    await rememberMerchantCategory(service, 'ZZ Shop', 'Transfer', 'ai')
    await rememberMerchantCategory(service, 'ZZ Shop', 'Top up', 'user')
    expect(rpc).not.toHaveBeenCalled()
    await rememberMerchantCategory(service, 'ZZ Shop', 'Health', 'ai')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('uniquePrefixCategory (a cut-off name against the user\'s own history)', () => {
  const earlier = [{ description: 'Some Corner Bakery', category: 'Food' }, { description: 'Other Place', category: 'Shopping' }]
  it('files a cut-off name with the one earlier merchant it is the start of, and the reverse', () => {
    expect(uniquePrefixCategory('Some Corn', earlier)).toBe('Food')
    expect(uniquePrefixCategory('Some Corner Bakery Branch 2', earlier)).toBe('Food')
  })
  it('needs five shared characters and exactly one fit', () => {
    expect(uniquePrefixCategory('Some', earlier)).toBeNull()
    expect(uniquePrefixCategory('Some Corn', [...earlier, { description: 'Some Corner Shop', category: 'Groceries' }])).toBeNull()
    expect(uniquePrefixCategory('Unrelated', earlier)).toBeNull()
  })
  it('never returns a money-movement category', () => {
    expect(uniquePrefixCategory('Some Corn', [{ description: 'Some Corner Bakery', category: 'Transfer' }])).toBeNull()
  })
})
