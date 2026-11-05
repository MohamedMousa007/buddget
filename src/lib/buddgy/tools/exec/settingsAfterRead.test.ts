import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))
import { TOOLS } from '@/lib/buddgy/tools/exec'

describe('change_setting after a read', () => {
  it('is held for approval when a read ran first', () => {
    const w = TOOLS.get('change_setting')!.write!
    const r = w.propose({ setting: 'learning', value: 'off' }, { now: new Date('2026-10-19T12:00:00'), locale: 'en', afterRead: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.proposal.risk).toBe('approve')
  })
})
