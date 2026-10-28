import { describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { bumpTemplateFailure } from './bumpTemplateFailure'

const svc = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as ServiceClient
const args = { templateId: 't1', hard: true, reason: 'r', userId: 'u1' }

describe('bumpTemplateFailure', () => {
  it('calls v2 with the user id', async () => {
    const rpc = vi.fn(async () => ({ error: null }))
    await bumpTemplateFailure(svc(rpc), args)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('bump_sms_template_failure_v2', { p_template_id: 't1', p_hard: true, p_reason: 'r', p_user_id: 'u1' })
  })

  it('falls back to the 3-arg call when v2 is not deployed', async () => {
    const rpc = vi.fn(async (name: string) => ({ error: name.endsWith('_v2') ? { code: 'PGRST202' } : null }))
    await bumpTemplateFailure(svc(rpc), args)
    expect(rpc).toHaveBeenLastCalledWith('bump_sms_template_failure', { p_template_id: 't1', p_hard: true, p_reason: 'r' })
  })

  it('does not retry on other errors', async () => {
    const rpc = vi.fn(async () => ({ error: { code: '42501' } }))
    await bumpTemplateFailure(svc(rpc), args)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('uses the legacy call when there is no user', async () => {
    const rpc = vi.fn(async () => ({ error: null }))
    await bumpTemplateFailure(svc(rpc), { ...args, userId: null })
    expect(rpc).toHaveBeenCalledWith('bump_sms_template_failure', { p_template_id: 't1', p_hard: true, p_reason: 'r' })
  })
})
