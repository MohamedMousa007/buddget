import { describe, expect, it, vi } from 'vitest'

const emit = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: emit }))
import { pauseSmsForLegacyBuild } from './pauseLegacySms'

function fakeService(language: string) {
  const calls: string[] = []
  const chain = (table: string, op: string) => {
    const c: Record<string, unknown> = {}
    c.eq = () => c
    c.is = () => { calls.push(`${table}:${op}`); return Promise.resolve({}) }
    c.maybeSingle = async () => ({ data: { language } })
    c.then = (r: (v: unknown) => void) => { calls.push(`${table}:${op}`); r({}) }
    return c
  }
  return {
    calls,
    from: (table: string) => ({ select: () => chain(table, 'select'), update: () => chain(table, 'update') }),
  } as never
}

describe('pauseSmsForLegacyBuild', () => {
  it('on first contact: notifies once in the user language, switches SMS off and retires device-less tokens', async () => {
    emit.mockReset().mockResolvedValue({ created: true })
    const svc = fakeService('ar')
    await pauseSmsForLegacyBuild(svc, 'u1')
    expect(emit).toHaveBeenCalledWith(svc, expect.objectContaining({ userId: 'u1', category: 'sms_paused_update', dedupeKey: 'sms-paused-legacy-build', push: false, title: expect.stringMatching(/[؀-ۿ]/) }))
    expect((svc as unknown as { calls: string[] }).calls).toEqual(expect.arrayContaining(['user_settings:update', 'sms_ingest_tokens:update']))
  })

  it('does nothing more once the account was already asked (idempotent, never re-disables a re-enabled account)', async () => {
    emit.mockReset().mockResolvedValue({ created: false })
    const svc = fakeService('en')
    await pauseSmsForLegacyBuild(svc, 'u1')
    expect((svc as unknown as { calls: string[] }).calls.some((c) => c.endsWith(':update'))).toBe(false)
  })
})
