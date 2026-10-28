import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: vi.fn() }))
import { setMain } from './registry'

type Call = { set: Record<string, unknown>; device: string | null }
function fake(failOn: 'none' | 'promote') {
  const calls: Call[] = []
  const service = {
    from: () => ({
      update: (set: Record<string, unknown>) => {
        const call: Call = { set, device: null }
        calls.push(call)
        const q: Record<string, unknown> = {}
        const done = () => Promise.resolve({ error: failOn === 'promote' && set.is_main === true && call.device === 'new' ? { message: 'unique' } : null })
        Object.assign(q, { eq: (c: string, v: string) => { if (c === 'device_id') call.device = v; return q }, neq: (_c: string, v: string) => { call.device = call.device ?? `not:${v}`; return q }, is: () => q, then: (r: (v: unknown) => unknown) => done().then(r) })
        return q
      },
    }),
  }
  return { service: service as never, calls }
}

describe('setMain', () => {
  it('demotes the old main, then promotes with the extra fields in the same write', async () => {
    const { service, calls } = fake('none')
    expect(await setMain(service, 'u1', 'new', { name: 'Work' })).toBe(true)
    expect(calls[0].set).toEqual({ is_main: false })
    expect(calls[1].set).toEqual({ is_main: true, name: 'Work' })
  })

  it('reports failure when the promotion fails', async () => {
    expect(await setMain(fake('promote').service, 'u1', 'new')).toBe(false)
  })
})
