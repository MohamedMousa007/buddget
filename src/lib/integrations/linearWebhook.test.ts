import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { freshTimestamp, parseIssueEvent, ticketStatusFor, validSignature } from './linearWebhook'

describe('linear webhook', () => {
  const sig = (raw: string) => createHmac('sha256', 's3cret').update(raw).digest('hex')
  it('accepts only the right signature', () => {
    expect(validSignature('{"a":1}', sig('{"a":1}'), 's3cret')).toBe(true)
    expect(validSignature('{"a":2}', sig('{"a":1}'), 's3cret')).toBe(false)
    expect(validSignature('{"a":1}', null, 's3cret')).toBe(false)
    expect(validSignature('{"a":1}', 'zz', 's3cret')).toBe(false)
  })
  it('rejects stale timestamps', () => {
    expect(freshTimestamp(1_000_000, 1_030_000)).toBe(true)
    expect(freshTimestamp(1_000_000, 1_100_000)).toBe(false)
    expect(freshTimestamp('x', 0)).toBe(false)
  })
  it('reads issue state updates and maps them', () => {
    expect(parseIssueEvent({ type: 'Issue', action: 'update', data: { identifier: 'BUD-1', state: { type: 'completed' } } })).toEqual({ identifier: 'BUD-1', stateType: 'completed' })
    expect(parseIssueEvent({ type: 'Comment', action: 'create' })).toBeNull()
    expect(ticketStatusFor('completed')).toBe('resolved')
    expect(ticketStatusFor('started')).toBe('open')
    expect(ticketStatusFor('canceled')).toBeNull()
  })
})
