import { describe, expect, it } from 'vitest'
import { summarizeUsage, type UsageStatus } from './usage'

const base: UsageStatus = {
  chat: null,
  windows: { h5: { used: 0, limit: 600, reset_at: null }, d1: { used: 150, limit: 1500, reset_at: null } },
  chats_today: { used: 2, limit: 100, reset_at: null },
}

describe('summarizeUsage', () => {
  it('shows the tightest limit, and ignores unlimited ones', () => {
    const s = summarizeUsage({ ...base, chat: { units: 30000, hard: 60000, turns: 4, max_turns: 40 }, windows: { ...base.windows, h5: { used: 0, limit: null, reset_at: null } } })
    expect(s.pct).toBe(50)
    expect(s.rows.find((r) => r.key === 'h5')?.pct).toBeNull()
  })

  it('lists no chat row before a chat exists, and caps at 100', () => {
    const s = summarizeUsage({ ...base, windows: { d1: { used: 9999, limit: 1500, reset_at: null } } })
    expect(s.rows.some((r) => r.key === 'chat')).toBe(false)
    expect(s.pct).toBe(100)
  })
})
