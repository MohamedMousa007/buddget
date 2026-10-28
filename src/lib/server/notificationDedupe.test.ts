import { describe, it, expect } from 'vitest'
import { contentDedupeKey, pushBody, PUSH_BODY_MAX } from './notificationDedupe'

describe('contentDedupeKey', () => {
  const t = Date.parse('2026-10-28T10:00:10Z')
  it('is the same for a double click on the same content', () => {
    expect(contentDedupeKey('support:u1', 'Hi', 'Body', t)).toBe(contentDedupeKey('support:u1', 'Hi', 'Body', t + 20_000))
  })
  it('differs for other content or a later window', () => {
    expect(contentDedupeKey('support:u1', 'Hi', 'Body', t)).not.toBe(contentDedupeKey('support:u1', 'Hi', 'Other', t))
    expect(contentDedupeKey('support:u1', 'Hi', 'Body', t)).not.toBe(contentDedupeKey('support:u1', 'Hi', 'Body', t + 10 * 60_000))
  })
})

describe('pushBody', () => {
  it('cuts long staff text for the lock screen', () => {
    expect(pushBody('x'.repeat(500)).length).toBe(PUSH_BODY_MAX)
    expect(pushBody('short')).toBe('short')
  })
})
