import { describe, expect, it } from 'vitest'
import { mergeList } from './merge'

/**
 * Offline-edit merge: union by id, newer `updatedAt` (then `createdAt`) wins, server on a
 * tie. PaymentMethod / RecurringExpense / SavingsTransaction carried NEITHER timestamp, so
 * every edit to them tied at `'' > ''` (false) and the server silently won — an offline
 * rename or amount change was discarded on the next sign-in merge.
 */
type Row = { id: string; updatedAt?: string; createdAt?: string; v: string }

describe('mergeList', () => {
  it('keeps a local edit that is newer than the server copy', () => {
    const server = [{ id: 'a', updatedAt: '2026-07-01T00:00:00Z', v: 'server' }]
    const local = [{ id: 'a', updatedAt: '2026-07-10T00:00:00Z', v: 'local edit' }]
    expect(mergeList<Row>(local, server)[0].v).toBe('local edit')
  })

  it('keeps the server copy when it is newer', () => {
    const server = [{ id: 'a', updatedAt: '2026-07-10T00:00:00Z', v: 'server' }]
    const local = [{ id: 'a', updatedAt: '2026-07-01T00:00:00Z', v: 'local stale' }]
    expect(mergeList<Row>(local, server)[0].v).toBe('server')
  })

  it('REGRESSION: an offline edit is NOT lost once both sides carry updatedAt', () => {
    // Reproduces the fix: server has the last-synced timestamp, the local mutation stamps
    // a newer one. Before the type change both were undefined -> '' > '' -> server wins.
    const server = [{ id: 'pm', updatedAt: '2026-07-01T00:00:00Z', v: 'HSBC' }]
    const local = [{ id: 'pm', updatedAt: '2026-07-17T00:00:00Z', v: 'HSBC ••0001' }]
    expect(mergeList<Row>(local, server)[0].v).toBe('HSBC ••0001')
  })

  it('demonstrates the OLD failure: with no timestamps at all, the edit is lost', () => {
    const server = [{ id: 'pm', v: 'HSBC' }]
    const local = [{ id: 'pm', v: 'HSBC ••0001' }]
    // '' > '' is false, so server wins — this is exactly the data loss the fix prevents.
    expect(mergeList<Row>(local, server)[0].v).toBe('HSBC')
  })

  it('unions rows that exist on only one side, regardless of timestamp', () => {
    const merged = mergeList<Row>(
      [{ id: 'local_only', v: 'L' }],
      [{ id: 'server_only', v: 'S' }],
    )
    expect(merged.map((r) => r.id).sort()).toEqual(['local_only', 'server_only'])
  })

  it('falls back to createdAt when updatedAt is absent', () => {
    const server = [{ id: 'a', createdAt: '2026-07-01T00:00:00Z', v: 'server' }]
    const local = [{ id: 'a', createdAt: '2026-07-10T00:00:00Z', v: 'local' }]
    expect(mergeList<Row>(local, server)[0].v).toBe('local')
  })
})

describe('mergeList compares times as instants', () => {
  it('a local edit stamped later than the server copy wins, whatever the offset notation', () => {
    const local = [{ id: 'g', name: 'edited', updatedAt: '2026-11-05T10:00:01.000Z' }]
    const server = [{ id: 'g', name: 'old', updatedAt: '2026-11-05T10:00:00.500000+00:00' }]
    expect(mergeList(local, server)[0].name).toBe('edited')
  })
  it('a server copy stamped later wins', () => {
    const local = [{ id: 'g', name: 'edited', updatedAt: '2026-11-05T10:00:00.000Z' }]
    const server = [{ id: 'g', name: 'newer', updatedAt: '2026-11-05T10:00:00.900000+00:00' }]
    expect(mergeList(local, server)[0].name).toBe('newer')
  })
})

describe('mergeList clock skew (SYN7)', () => {
  it('orders a device stamp on the server clock: a clock running 2 h ahead no longer keeps a stale row', async () => {
    const { noteServerTime, resetServerClock } = await import('./serverClock')
    noteServerTime(new Date(Date.now() - 2 * 3_600_000).toISOString())
    const nowLocal = new Date().toISOString()
    const serverEdit = new Date(Date.now() - 3_600_000).toISOString().replace('Z', '+00:00')
    const local = [{ id: 'a', updatedAt: nowLocal, v: 'local stale' }]
    const server = [{ id: 'a', updatedAt: serverEdit, v: 'server newer' }]
    expect(mergeList<Row>(local, server)[0].v).toBe('server newer')
    resetServerClock()
    expect(mergeList<Row>(local, server)[0].v).toBe('local stale')
  })
})

describe('mergeList with the delivered-edit set', () => {
  it('a row with nothing undelivered takes the server copy even when offset noise makes its stamp look newer', () => {
    const server = [{ id: 'a', updatedAt: '2026-07-01T00:00:00.000+00:00', v: 'server (paired by SMS)' }]
    const local = [{ id: 'a', updatedAt: '2026-07-01T00:00:00.400Z', v: 'local' }]
    expect(mergeList<Row>(local, server, new Set())[0].v).toBe('server (paired by SMS)')
    expect(mergeList<Row>(local, server)[0].v).toBe('local')
  })

  it('an undelivered edit still competes: newer wins, older loses', () => {
    const server = [{ id: 'a', updatedAt: '2026-07-01T00:00:00.000+00:00', v: 'server' }]
    expect(mergeList<Row>([{ id: 'a', updatedAt: '2026-07-01T00:05:00Z', v: 'newer local' }], server, new Set(['a']))[0].v).toBe('newer local')
    expect(mergeList<Row>([{ id: 'a', updatedAt: '2026-06-30T23:00:00Z', v: 'older local' }], server, new Set(['a']))[0].v).toBe('server')
  })

  it('a local edit the baseline never recorded (far newer) is kept', () => {
    const server = [{ id: 'a', updatedAt: '2026-07-01T00:00:00.000+00:00', v: 'server' }]
    expect(mergeList<Row>([{ id: 'a', updatedAt: '2026-07-01T00:10:00Z', v: 'unrecorded local' }], server, new Set())[0].v).toBe('unrecorded local')
  })
})
