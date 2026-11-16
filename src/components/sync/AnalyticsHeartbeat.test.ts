import { describe, expect, it } from 'vitest'
import { FLUSH_INTERVAL_MS } from './AnalyticsHeartbeat'

describe('AnalyticsHeartbeat', () => {
  it('flushes a visible app at most every 10 minutes (hiding the app flushes separately)', () => {
    expect(FLUSH_INTERVAL_MS).toBeGreaterThanOrEqual(10 * 60 * 1000)
  })
})
