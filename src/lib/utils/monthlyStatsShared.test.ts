import { describe, expect, it, vi } from 'vitest'

const compute = vi.fn((input: { monthFilter: string }) => ({ month: input.monthFilter }))
vi.mock('./monthlyStats', () => ({ computeMonthlyStats: compute }))

describe('computeMonthlyStatsShared', () => {
  it('computes once for shallow-equal inputs across callers, recomputes when any input ref changes', async () => {
    const { computeMonthlyStatsShared } = await import('./monthlyStatsShared')
    const expenses: unknown[] = []
    const base = { expenses, monthFilter: '2026-10' } as never
    const a = computeMonthlyStatsShared({ ...(base as object) } as never)
    const b = computeMonthlyStatsShared({ ...(base as object) } as never)
    expect(b).toBe(a)
    expect(compute).toHaveBeenCalledTimes(1)
    computeMonthlyStatsShared({ expenses: [], monthFilter: '2026-10' } as never)
    expect(compute).toHaveBeenCalledTimes(2)
  })
})
