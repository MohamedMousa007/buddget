import { describe, it, expect } from 'vitest'
import { SYNC_NOTICE_QUIET_MS, takeSyncNotice } from '@/lib/store/syncNoticeThrottle'

describe('takeSyncNotice (QA W4: the sync-conflict toast stays for minutes)', () => {
  it('shows a notice once, stays quiet while every sync pass repeats it, and shows it again after a quiet minute', () => {
    const shown = new Map<string, number>()
    expect(takeSyncNotice(shown, 'editReplaced', 0)).toBe(true)
    expect(takeSyncNotice(shown, 'editReplaced', 5_000)).toBe(false)
    expect(takeSyncNotice(shown, 'undoRefused', 5_000)).toBe(true)
    expect(takeSyncNotice(shown, 'editReplaced', SYNC_NOTICE_QUIET_MS)).toBe(true)
  })
})
