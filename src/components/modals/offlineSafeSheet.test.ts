import { describe, expect, it } from 'vitest'
import { offlineSafe } from './offlineSafeSheet'

describe('R13 / offline: a lazy sheet whose chunk cannot load never crashes the app', () => {
  it('a failed chunk load resolves to a stand-in component instead of rejecting', async () => {
    const load = offlineSafe(() => Promise.reject(new Error('ChunkLoadError: Loading chunk AddPaymentMethodSheet failed')))
    await expect(load()).resolves.toEqual(expect.any(Function))
  })

  it('a chunk that loads is returned as is', async () => {
    const Sheet = () => null
    await expect(offlineSafe(async () => Sheet)()).resolves.toBe(Sheet)
  })
})
