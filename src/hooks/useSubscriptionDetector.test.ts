import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  order: vi.fn(),
  limit: vi.fn(),
  rowsNewestFirst: [{ received_at: '2026-03-03', created_at: '2026-03-03' }, { received_at: '2026-03-02', created_at: '2026-03-02' }],
  setRows: vi.fn(),
}))

vi.mock('react', () => ({
  useEffect: (fn: () => void) => { fn() },
  useMemo: <T,>(fn: () => T) => fn(),
  useState: (init: unknown) => [init, h.setRows],
}))
vi.mock('zustand/react/shallow', () => ({ useShallow: (f: unknown) => f }))
vi.mock('@/lib/store/useFinanceStore', () => ({
  useFinanceStore: (sel: (s: unknown) => unknown) => sel({ settings: { smsTrackingEnabled: true }, subscriptions: [], expenses: [] }),
}))
vi.mock('@/lib/store/useSettingsStore', () => ({ useSettingsStore: (sel: (s: unknown) => unknown) => sel({ dismissedBanners: [] }) }))
vi.mock('@/lib/query/sharedFetch', () => ({ sharedFetch: (_k: string, _t: number, load: () => Promise<unknown>) => load() }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'gte']) q[m] = () => q
    q.order = (...a: unknown[]) => { h.order(...a); return q }
    q.limit = (n: number) => { h.limit(n); return Promise.resolve({ data: h.rowsNewestFirst }) }
    return { from: () => q }
  },
}))

import { useSubscriptionDetector } from './useSubscriptionDetector'

describe('useSubscriptionDetector read', () => {
  it('reads the newest 1000 and hands rows to the detector oldest-first', async () => {
    useSubscriptionDetector()
    await new Promise((r) => setTimeout(r, 0))
    expect(h.order).toHaveBeenCalledWith('received_at', { ascending: false })
    expect(h.limit).toHaveBeenCalledWith(1000)
    const rows = h.setRows.mock.calls.map((c) => c[0]).find((v) => Array.isArray(v) && v.length) as { received_at: string }[]
    expect(rows.map((r) => r.received_at)).toEqual(['2026-03-02', '2026-03-03'])
    expect(rows[0]).toMatchObject({ day: '2026-03-02' })
  })
})
