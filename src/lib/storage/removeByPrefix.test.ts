import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearNetWorthStamps, removeKeysWithPrefix } from '@/lib/storage/removeByPrefix'

const fake = (init: Record<string, string>) => {
  const store = new Map(Object.entries(init))
  return {
    store,
    storage: { get length() { return store.size }, key: (i: number) => [...store.keys()][i] ?? null, removeItem: (k: string) => void store.delete(k) },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('removeKeysWithPrefix', () => {
  it('removes only matching keys', () => {
    const { store, storage } = fake({ 'a:1': 'x', 'a:2': 'y', b: 'z' })
    removeKeysWithPrefix(['a:'], storage)
    expect([...store.keys()]).toEqual(['b'])
  })
  it('survives a storage that throws', () => {
    expect(() => removeKeysWithPrefix(['a'], { get length(): number { throw new Error('denied') }, key: () => null, removeItem: () => undefined })).not.toThrow()
  })
})

describe('OFS-5 net-worth stamps', () => {
  it('a data reset drops the stamp so today is written again', () => {
    const { store, storage } = fake({ 'bdg-nw:u1:2026-11-06:EGP:legacy': '10.00', keep: '1' })
    vi.stubGlobal('window', { localStorage: storage })
    clearNetWorthStamps()
    expect([...store.keys()]).toEqual(['keep'])
  })
})
