import { describe, expect, it, vi } from 'vitest'
import { claimPriceRefresh } from './claimPriceRefresh'

function fake(updated: unknown[] | null, inserted: unknown[] | null = []) {
  const lt = vi.fn()
  const q = { eq: () => q, lt: (...a: unknown[]) => { lt(...a); return q }, select: () => Promise.resolve({ data: updated, error: updated ? null : { message: 'x' } }) }
  const ins = { select: () => Promise.resolve({ data: inserted, error: null }) }
  const service = { from: () => ({ update: () => q, upsert: () => ins }) }
  return { service: service as never, lt }
}

describe('claimPriceRefresh', () => {
  const now = Date.parse('2026-10-27T12:00:00Z')

  it('wins when the conditional update touched the row, comparing against the debounce cutoff', async () => {
    const { service, lt } = fake([{ key: 'k' }])
    expect(await claimPriceRefresh(service, now, 3_600_000)).toBe(true)
    expect(lt).toHaveBeenCalledWith('value->>at', '2026-10-27T11:00:00.000Z')
  })

  it('wins on a first-ever attempt through the insert', async () => {
    expect(await claimPriceRefresh(fake([], [{ key: 'k' }]).service, now, 3_600_000)).toBe(true)
  })

  it('loses when another caller already holds a recent attempt', async () => {
    expect(await claimPriceRefresh(fake([], []).service, now, 3_600_000)).toBe(false)
  })

  it('loses on a database error rather than stampeding the providers', async () => {
    expect(await claimPriceRefresh(fake(null).service, now, 3_600_000)).toBe(false)
  })
})
