import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptySnapshot } from '@/lib/supabase/remote'
import { diffLists } from '@/lib/supabase/remote/diff'
import { baselineForBoot, baselineFromFingerprint, fingerprintOf, saveFingerprint } from '@/components/sync/flushedFingerprint'
import type { Expense } from '@/lib/store/types'

const exp = (id: string, amount: number) => ({ id, amount, description: id, category: 'Food', currency: 'EGP', date: '2026-11-05' }) as unknown as Expense

describe('baselineFromFingerprint', () => {
  const serverHad = { ...emptySnapshot(), expenses: [exp('kept', 10), exp('edited', 20), exp('deleted', 30)] }
  const fp = fingerprintOf(serverHad)
  // What the cache holds after offline work: one edit, one new row, one delete, and one row left alone.
  const cache = { ...emptySnapshot(), expenses: [exp('kept', 10), exp('edited', 25), exp('created', 5)] }
  const diff = diffLists(cache.expenses, baselineFromFingerprint(cache, fp).expenses)

  it('sends the row edited offline as an update', () => expect(diff.updates.map((r) => r.id)).toEqual(['edited']))
  it('sends the row created offline as an insert', () => expect(diff.inserts.map((r) => r.id)).toEqual(['created']))
  it('sends the row deleted offline as a delete', () => expect(diff.deletes).toEqual(['deleted']))
  it('sends nothing when the cache is what the server received', () => {
    const same = baselineFromFingerprint(serverHad, fp)
    expect(diffLists(serverHad.expenses, same.expenses)).toEqual({ inserts: [], updates: [], deletes: [] })
  })
  it('re-sends a singleton edited offline', () => {
    const edited = { ...serverHad, financialGoalsNotes: 'new note' }
    expect(baselineFromFingerprint(edited, fp).financialGoalsNotes).not.toBe('new note')
    expect(baselineFromFingerprint(serverHad, fp).financialGoalsNotes).toBe(serverHad.financialGoalsNotes)
  })
  it('does not depend on key order', () => {
    const reordered = { ...serverHad, expenses: serverHad.expenses.map((r) => Object.fromEntries(Object.entries(r).reverse()) as unknown as Expense) }
    expect(diffLists(reordered.expenses, baselineFromFingerprint(reordered, fp).expenses).updates).toEqual([])
  })
})

describe('OFS-12 row hash memo', () => {
  it('serialises an unchanged row object once across fingerprints', async () => {
    const { fingerprintOf } = await import('./flushedFingerprint')
    const { emptySnapshot } = await import('@/lib/supabase/remote')
    let reads = 0
    const row = { id: 'e1', get amount() { reads++; return 5 } }
    const snap = { ...emptySnapshot(), expenses: [row] } as never
    const first = fingerprintOf(snap)
    const afterFirst = reads
    const second = fingerprintOf(snap)
    expect(second).toEqual(first)
    expect(reads).toBe(afterFirst)
  })
})

describe('REG-10 hash width', () => {
  const store = new Map<string, string>()
  afterEach(() => { vi.unstubAllGlobals(); store.clear() })
  const stub = () => vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })

  it('a row hash is length plus two 32-bit hashes (64 bits of content)', () => {
    const fp = fingerprintOf({ ...emptySnapshot(), expenses: [exp('a', 1)] })
    expect(Object.values(fp.lists.expenses)[0]).toMatch(/^[0-9a-z]+\.[0-9a-z]+\.[0-9a-z]+$/)
    expect(fp.v).toBe(2)
  })

  it('a fingerprint stored in the old 32-bit format is ignored instead of re-sending every row', () => {
    stub()
    const cache = { ...emptySnapshot(), expenses: [exp('a', 1), exp('b', 2)] }
    store.set('buddget:flushed:u1', JSON.stringify({ lists: { expenses: { a: 'x.1', b: 'y.2' } }, singles: {} }))
    expect(baselineForBoot('u1', cache)).toBe(cache)
  })

  it('a current fingerprint round-trips through storage', () => {
    stub()
    const server = { ...emptySnapshot(), expenses: [exp('a', 1)] }
    saveFingerprint('u1', server)
    const cache = { ...server, expenses: [exp('a', 9)] }
    expect(diffLists(cache.expenses, baselineForBoot('u1', cache).expenses).updates.map((r) => r.id)).toEqual(['a'])
  })
})

describe('QA-81 fingerprint never outruns the persisted store', () => {
  const store = new Map<string, string>()
  afterEach(async () => {
    vi.unstubAllGlobals()
    store.clear()
    ;(await import('@/lib/store/safeLocalStorage')).__resetSafeStorageForTests()
  })
  const stubQuota = () => {
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { if (k === 'big-store' || k === 'buddget-storage') throw new Error('QuotaExceededError'); store.set(k, v) },
      removeItem: (k: string) => void store.delete(k),
    }
    vi.stubGlobal('window', { localStorage: ls, dispatchEvent: () => true })
    vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} })
    vi.stubGlobal('localStorage', ls)
  }

  it('keeps the older fingerprint while the store write is held only in memory', async () => {
    stubQuota()
    saveFingerprint('u1', { ...emptySnapshot(), expenses: [exp('a', 1)] })
    const older = store.get('buddget:flushed:u1')
    expect(older).toBeDefined()
    const { createSafeLocalStorage } = await import('@/lib/store/safeLocalStorage')
    createSafeLocalStorage().setItem('buddget-storage', 'x')
    expect(saveFingerprint('u1', { ...emptySnapshot(), expenses: [exp('a', 1), exp('b', 2)] })).toBe(false)
    expect(store.get('buddget:flushed:u1')).toBe(older)
  })

  it('is not frozen by another store (chats, settings) being over quota', async () => {
    stubQuota()
    const { createSafeLocalStorage } = await import('@/lib/store/safeLocalStorage')
    createSafeLocalStorage().setItem('big-store', 'x')
    expect(saveFingerprint('u1', { ...emptySnapshot(), expenses: [exp('a', 1)] })).toBe(true)
    expect(store.get('buddget:flushed:u1')).toBeDefined()
  })

  it('advances the fingerprint once nothing is held in memory', async () => {
    stubQuota()
    const { createSafeLocalStorage } = await import('@/lib/store/safeLocalStorage')
    const s = createSafeLocalStorage()
    s.setItem('buddget-storage', 'x')
    s.removeItem('buddget-storage')
    saveFingerprint('u1', { ...emptySnapshot(), expenses: [exp('a', 1)] })
    saveFingerprint('u1', { ...emptySnapshot(), expenses: [exp('a', 1), exp('b', 2)] })
    expect(Object.keys(JSON.parse(store.get('buddget:flushed:u1')!).lists.expenses)).toEqual(['a', 'b'])
  })
})
