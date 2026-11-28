import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), updates: [] as { values: unknown; id: string }[] }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: h.rpc,
    from: () => ({ update: (values: unknown) => ({ eq: async (_c: string, id: string) => { h.updates.push({ values, id }); return { error: null } } }) }),
  }),
}))

import { GET } from './route'

const req = () => new Request('http://x/api/cron/waitlist-referrals', { headers: { authorization: 'Bearer s3cret' } })
const cand = (o: Partial<Record<string, unknown>> = {}) => ({ waitlist_id: 'w1', invitee_id: 'u-b', invitee_email: 'Sara.Q@gmail.com', inviter_id: 'u-a', inviter_code: 'LAYLA-7K2', ...o })

function rpcAnswers(candidates: unknown[], redeem: Record<string, unknown> | null, ensure = 'NEW-ABC') {
  h.rpc.mockImplementation(async (name: string) => {
    if (name === 'waitlist_referral_candidates') return { data: candidates, error: null }
    if (name === 'referral_ensure_code') return { data: ensure, error: null }
    if (name === 'referral_redeem') return redeem ? { data: redeem, error: null } : { data: null, error: { code: '57014' } }
    throw new Error(name)
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = 's3cret'
  delete process.env.TRIAL_CLAIM_KEY_SECRET
  h.rpc.mockReset()
  h.updates = []
})

describe('GET /api/cron/waitlist-referrals', () => {
  it('redeems in waitlist mode with the normalised mailbox and marks the row settled', async () => {
    rpcAnswers([cand()], { status: 'ok' })
    const body = await (await GET(req())).json()
    expect(body).toMatchObject({ ok: true, candidates: 1, counts: { ok: 1 } })
    expect(h.rpc).toHaveBeenCalledWith('referral_redeem', expect.objectContaining({ p_user: 'u-b', p_code: 'LAYLA-7K2', p_mailbox_key: 'saraq@gmail.com', p_waitlist: true }))
    expect(h.updates).toEqual([{ id: 'w1', values: expect.objectContaining({ referral_status: 'ok' }) }])
  })

  it('creates the inviter code when the inviter never opened the invite screen', async () => {
    rpcAnswers([cand({ inviter_code: null })], { status: 'ok' })
    await GET(req())
    expect(h.rpc).toHaveBeenCalledWith('referral_ensure_code', { p_user: 'u-a' })
    expect(h.rpc).toHaveBeenCalledWith('referral_redeem', expect.objectContaining({ p_code: 'NEW-ABC' }))
  })

  it('settles a refusal but leaves a transient answer or a database error for the next run', async () => {
    rpcAnswers([cand()], { status: 'self_invite' })
    await GET(req())
    expect(h.updates).toHaveLength(1)
    h.updates = []
    rpcAnswers([cand()], { status: 'disabled' })
    await GET(req())
    rpcAnswers([cand()], null)
    await GET(req())
    expect(h.updates).toHaveLength(0)
  })

  it('never redeems for a disposable mailbox and settles it', async () => {
    rpcAnswers([cand({ invitee_email: 'x@mailinator.com' })], { status: 'ok' })
    await GET(req())
    expect(h.rpc).not.toHaveBeenCalledWith('referral_redeem', expect.anything())
    expect(h.updates[0].values).toMatchObject({ referral_status: 'disposable_email' })
  })

  it('answers 500 when the candidate query fails', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect((await GET(req())).status).toBe(500)
  })
})
