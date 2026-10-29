import { describe, expect, it } from 'vitest'
import { buildNetWorthTrend } from './netWorthTrend'

describe('buildNetWorthTrend', () => {
  it('is null below two snapshots so a stale trend gets cleared', () => {
    expect(buildNetWorthTrend(null)).toBeNull()
    expect(buildNetWorthTrend([{ net_worth: 5 }])).toBeNull()
  })
  it('computes direction and percent', () => {
    expect(buildNetWorthTrend([{ net_worth: '100' }, { net_worth: 150 }])).toEqual({ points: [100, 150], pct: 50, dir: 'up' })
  })
})
