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
