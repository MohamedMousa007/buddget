import { describe, it, expect, vi } from 'vitest'
import { resolveMerchantCategory, resolveMerchantCategoryInfo, rememberMerchantCategory, uniquePrefixCategory } from '../merchantCategoryCache'
import type { ServiceClient } from '@/lib/supabase/service'
import { createSmsExpense } from '../createSmsExpense'

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
        return { data: matches ? { category: hit.category, category_source: hit.category_source ?? null } : null }
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

describe('a category that is only an AI suggestion', () => {
  it('stays a suggestion when a later purchase inherits it from the earlier one', async () => {
    const { service } = fakeService({ expenses: { user_id: 'u1', description: 'ZZ Shop', category: 'Food', category_source: 'ai_suggested' } })
    expect(await resolveMerchantCategoryInfo(service, 'ZZ Shop', 'u1')).toEqual({ category: 'Food', suggested: true })
  })

  it('is a fact once the user confirmed or changed it, and when a rule names it', async () => {
    const confirmed = fakeService({ expenses: { user_id: 'u1', description: 'ZZ Shop', category: 'Food', category_source: 'user_confirmed' } })
    expect(await resolveMerchantCategoryInfo(confirmed.service, 'ZZ Shop', 'u1')).toEqual({ category: 'Food', suggested: false })
    expect(await resolveMerchantCategoryInfo(fakeService({}).service, 'Kazyon', 'u1')).toEqual({ category: 'Groceries', suggested: false })
  })
})

describe('createSmsExpense marks an AI category as a suggestion', () => {
  function svc() {
    const inserted: Record<string, unknown>[] = []
    const chain: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'neq', 'ilike', 'is', 'not', 'in', 'order', 'limit']) chain[k] = () => chain
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
    chain.then = (r: (v: unknown) => unknown) => r({ data: [], error: null })
    chain.insert = (row: Record<string, unknown>) => {
      inserted.push(row)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }) }
    }
    return { service: { from: () => chain, rpc: async () => ({ error: null }) } as unknown as ServiceClient, inserted }
  }
  const row = (over: Record<string, unknown>) => ({
    userId: 'u1', amount: 50, currency: 'EGP', day: '2026-11-01', kind: 'purchase', cleanTitle: null, merchantNormalized: null,
    merchant: 'ZZ Shop', bankName: null, categoryHint: null, source: 'sms', rawBody: 'Purchase of 50.00 at ZZ SHOP', ...over,
  }) as never

  it("the AI's category for an unknown merchant is applied and flagged", async () => {
    const { service, inserted } = svc()
    await createSmsExpense(service, row({ categoryHint: 'restaurant' }))
    expect(inserted[0]).toMatchObject({ category: 'Food', category_source: 'ai_suggested' })
  })

  it('a dictionary category and an uncategorised row carry no flag', async () => {
    const a = svc()
    await createSmsExpense(a.service, row({ merchant: 'Kazyon', categoryHint: 'restaurant' }))
    expect(a.inserted[0]).toMatchObject({ category: 'Groceries', category_source: null })
    const b = svc()
    await createSmsExpense(b.service, row({}))
    expect(b.inserted[0]).toMatchObject({ category: 'Other', category_source: null })
  })
})
