import { describe, expect, it } from 'vitest'
import { compareFlowItems, instantOf } from './flowOrder'

describe('compareFlowItems', () => {
  it('orders inside a day by instant, newest first', () => {
    const rows = [
      { id: 'a', date: '2026-10-05', at: instantOf('2026-10-05T08:00:00', '2026-10-05') },
      { id: 'b', date: '2026-10-05', at: instantOf('2026-10-05T20:00:00', '2026-10-05') },
      { id: 'c', date: '2026-10-06', at: instantOf('2026-10-06T01:00:00', '2026-10-06') },
    ]
    expect(rows.sort(compareFlowItems).map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })
  it('keeps insertion order for ties', () => {
    const rows = ['a', 'b', 'c'].map((id) => ({ id, date: '2026-10-05', at: instantOf(undefined, '2026-10-05') }))
    expect(rows.sort(compareFlowItems).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
  it('falls back to noon when there is no instant', () => {
    expect(instantOf(undefined, '2026-10-05')).toBe(new Date(2026, 9, 5, 12).getTime())
  })
  it('falls back to the day when occurredAt is malformed', () => {
    expect(instantOf('garbage', '2026-10-05')).toBe(new Date(2026, 9, 5, 12).getTime())
  })
})
