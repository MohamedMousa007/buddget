import { describe, expect, it } from 'vitest'
import { recordIngestRefusal } from './ingestRefusal'

const EVENT = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b'

function fake() {
  const rows: Array<Record<string, unknown>> = []
  return { rows, service: { from: () => ({ insert: async (r: Record<string, unknown>) => { rows.push(r); return {} } }) } as never }
}
const req = (eventId?: string) => new Request('http://x', { headers: eventId ? { 'x-sms-event-id': eventId } : {} })

describe('recordIngestRefusal', () => {
  it('writes one failed row keyed by reason and event id so staff can see a refused message', async () => {
    const { rows, service } = fake()
    await recordIngestRefusal(service, { userId: 'u1', deviceId: 'd1' }, req(EVENT), 'device_blocked')
    expect(rows).toEqual([expect.objectContaining({ user_id: 'u1', status: 'failed', failure_code: 'device_blocked', sms_hash: `refused:device_blocked:${EVENT}`, device_id: 'd1' })])
  })

  it('writes nothing without an event id (a retry could not be de-duplicated)', async () => {
    const { rows, service } = fake()
    await recordIngestRefusal(service, { userId: 'u1', deviceId: null }, req(), 'invalid_body')
    await recordIngestRefusal(service, { userId: 'u1', deviceId: null }, req('not-a-uuid'), 'invalid_body')
    expect(rows).toEqual([])
  })

  it('never throws into the request path', async () => {
    const service = { from: () => ({ insert: async () => { throw new Error('db down') } }) } as never
    await expect(recordIngestRefusal(service, { userId: 'u1', deviceId: null }, req(EVENT), 'invalid_json')).resolves.toBeUndefined()
  })
})
