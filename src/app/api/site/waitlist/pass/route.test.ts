import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ name: null as string | null, rpc: vi.fn(), eq: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: h.rpc,
    from: () => ({ select: () => ({ eq: (c: string, v: string) => { h.eq(c, v); return { maybeSingle: async () => ({ data: h.name === null ? null : { name: h.name } }) } } }) }),
  }),
}))

import { resetMemoryGate } from '@/lib/server/publicApiRateLimit'
import { firstWord } from '@/lib/site/waitlist'
import { GET } from './route'

let ip = 0
const get = async (code: string) => (await GET(new Request(`http://x/api/site/waitlist/pass?code=${encodeURIComponent(code)}`, { headers: { 'x-forwarded-for': `10.1.0.${++ip}` } }))).json()

beforeEach(() => { resetMemoryGate(); h.name = null; h.rpc.mockReset(); h.eq.mockReset() })

describe('GET /api/site/waitlist/pass', () => {
  it('returns only the first word of a waitlist member name, by share code', async () => {
    h.name = '  Layla Hassan Mostafa '
    expect(await get('w7k2qxma')).toEqual({ name: 'Layla' })
    expect(h.eq).toHaveBeenCalledWith('share_code', 'W7K2QXMA')
  })

  it('uses the app lookup for an in-app code', async () => {
    h.rpc.mockResolvedValue({ data: 'Mohamed Ali', error: null })
    expect(await get('mohame-7k2')).toEqual({ name: 'Mohamed' })
    expect(h.rpc).toHaveBeenCalledWith('referral_inviter_first_name', { p_code: 'MOHAME-7K2' })
  })

  it('answers null for an unknown or malformed code without touching the app lookup', async () => {
    expect(await get('W2222222')).toEqual({ name: null })
    expect(await get('<script>')).toEqual({ name: null })
    expect(await get('')).toEqual({ name: null })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('firstWord caps the signature at 24 characters and keeps Arabic intact', () => {
    expect(firstWord('ليلى حسن')).toBe('ليلى')
    expect(firstWord('A'.repeat(40))).toHaveLength(24)
    expect(firstWord('   ')).toBeNull()
  })
})
