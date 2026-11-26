import { describe, expect, it } from 'vitest'
import { formatTimeIdCursor, parseTimeIdCursor, timeIdBefore } from './timeIdCursor'

const ID = '11111111-1111-4111-8111-111111111111'
const TS = '2026-11-01T10:00:00.123456+00:00'

describe('compound (timestamp, id) cursor', () => {
  it('round-trips a cursor', () => {
    expect(parseTimeIdCursor(formatTimeIdCursor(TS, ID))).toEqual({ ts: TS, id: ID })
  })

  it.each([null, '', TS, `${TS}|nope`, `not-a-date|${ID}`, `2026-11-01|${ID}`])('rejects %s', (raw) => {
    expect(parseTimeIdCursor(raw)).toBeNull()
  })

  it('builds a filter that breaks ties on id', () => {
    expect(timeIdBefore('received_at', { ts: TS, id: ID })).toBe(`received_at.lt.${TS},and(received_at.eq.${TS},id.lt.${ID})`)
  })
})
