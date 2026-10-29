import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_ATTEMPTS, drainOutbox } from './outbox'
import type { ServiceClient } from '@/lib/supabase/service'

const row = (attempts: number) => ({
  id: 'o1', ticket_id: 't1', attempts, payload: { number: 7, kind: 'bug', area: null, severity: 'normal', subject: 'Crash on launch', platform: null, version: null },
})

function fakeService(rows: unknown[], linked: string | null = null) {
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = []
  const service = {
    rpc: vi.fn(async () => ({ data: rows })),
    from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { linear_issue_id: linked } }) }) }), update: (patch: Record<string, unknown>) => ({ eq: async () => { updates.push({ table, patch }); return {} } }) }),
  } as unknown as ServiceClient
  return { service, updates }
}

afterEach(() => vi.unstubAllGlobals())

describe('drainOutbox', () => {
  it('does nothing without a Linear key, and leaves rows queued', async () => {
    const { service } = fakeService([row(1)])
    expect(await drainOutbox(service, undefined)).toBe(0)
    expect(service.rpc).not.toHaveBeenCalled()
  })
  it('marks a delivered row sent and links the issue on the ticket', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { issueCreate: { success: true, issue: { id: 'i', identifier: 'BUD-1', url: 'https://l/BUD-1' } } } }))))
    const { service, updates } = fakeService([row(1)])
    expect(await drainOutbox(service, 'key')).toBe(1)
    expect(updates).toEqual([
      { table: 'support_tickets', patch: { linear_issue_id: 'BUD-1', linear_issue_url: 'https://l/BUD-1' } },
      { table: 'integration_outbox', patch: expect.objectContaining({ status: 'sent' }) },
    ])
  })
  it('a ticket that already has its Linear issue is marked sent without creating a duplicate', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { service, updates } = fakeService([row(2)], 'BUD-1')
    expect(await drainOutbox(service, 'key')).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(updates).toEqual([{ table: 'integration_outbox', patch: expect.objectContaining({ status: 'sent' }) }])
  })
  it('a failure keeps the row for a retry, and only dead-letters after the last attempt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    const first = fakeService([row(1)])
    expect(await drainOutbox(first.service, 'key')).toBe(0)
    expect(first.updates[0].patch).toMatchObject({ status: 'failed', last_error: expect.any(String) })
    const last = fakeService([row(MAX_ATTEMPTS)])
    await drainOutbox(last.service, 'key')
    expect(last.updates[0].patch).toMatchObject({ status: 'dead' })
  })
})
