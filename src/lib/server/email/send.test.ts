import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => { throw new Error('tests pass a service') } }))
vi.mock('./render', () => ({ renderEmail: async () => ({ subject: 's', html: '<body>h</body>', locale: 'en', origin: 'builtin' }) }))
vi.mock('./store', () => ({ resolveUserLocale: async () => 'en', loadPublished: async () => null }))
vi.mock('./suppression', () => ({ isSuppressed: async () => false }))

import { sendTemplatedEmail } from './send'

function fakeService(insertErrors: Array<{ code: string; message: string } | null> = []) {
  const rows: Array<Record<string, unknown>> = []
  const service = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        rows.push(row)
        return { error: insertErrors.shift() ?? null }
      },
    }),
  }
  return { service: service as never, rows }
}

const to = { email: 'qa-e2e-x@buddget-qa.test', id: 'u1' }

describe('sendTemplatedEmail', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'p1' }), { status: 200 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('a dev or QA server without a key sends nothing and writes no log row', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const { service, rows } = fakeService()
    expect(await sendTemplatedEmail('welcome', to, {}, { service })).toEqual({ ok: false, error: 'RESEND_API_KEY is not set' })
    expect(rows).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('production without a key still records the failure', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('VERCEL_ENV', 'production')
    const { service, rows } = fakeService()
    expect((await sendTemplatedEmail('welcome', to, {}, { service })).ok).toBe(false)
    expect(rows).toEqual([expect.objectContaining({ status: 'failed', error: 'RESEND_API_KEY is not set' })])
  })

  it('a sign-up hook whose user is not committed yet keeps the log row without the user link', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k')
    const { service, rows } = fakeService([{ code: '23503', message: 'fk' }, null])
    expect((await sendTemplatedEmail('confirm_signup', to, {}, { service, source: 'auth_hook' })).ok).toBe(true)
    expect(rows.map((r) => r.user_id)).toEqual(['u1', null])
    expect(rows[1]).toMatchObject({ status: 'sent', source: 'auth_hook' })
  })

  it('the hook answers before logging and gives Resend 2.5 s, other mail 4 s', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k')
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const deferred: Array<() => Promise<void>> = []
    const { service, rows } = fakeService()
    await sendTemplatedEmail('confirm_signup', to, {}, { service, source: 'auth_hook', defer: (t) => deferred.push(t) })
    expect(timeout).toHaveBeenLastCalledWith(2500)
    expect(rows).toHaveLength(0)
    await deferred[0]()
    expect(rows).toHaveLength(1)
    await sendTemplatedEmail('welcome', to, {}, { service })
    expect(timeout).toHaveBeenLastCalledWith(4000)
  })
})
