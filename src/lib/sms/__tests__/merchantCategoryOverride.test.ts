import { describe, it, expect, vi } from 'vitest'
import { resolveMerchantCategory, rememberMerchantCategory } from '../merchantCategoryCache'
import type { ServiceClient } from '@/lib/supabase/service'

function fakeService(rows: Record<string, Record<string, unknown>>) {
  const queried: string[] = []
  const rpc = vi.fn(async () => ({ error: null }))
  const from = (table: string) => {
    const filters: Record<string, unknown> = {}
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => { filters[col] = val; return q },
      maybeSingle: async () => {
        queried.push(table)
        const hit = rows[table]
        const matches = hit && Object.entries(filters).every(([k, v]) => hit[k] === undefined || hit[k] === v)
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
    expect(queried).toEqual(['merchant_category_overrides', 'merchant_categories'])
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
