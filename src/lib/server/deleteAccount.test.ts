import { describe, expect, it, vi } from 'vitest'
import { deleteUserCompletely } from './deleteAccount'
import { USER_DATA_TABLES } from './userData'
import type { ServiceClient } from '@/lib/supabase/service'

function fakeAdmin(staffRole: string | null) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = []
  const deleteUser = vi.fn(async () => ({ error: null }))
  const from = (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'admin_staff' && staffRole ? { role_key: staffRole } : null }) }) }),
    delete: () => ({ eq: async () => { calls.push({ table, op: 'delete' }); return { error: null } } }),
    update: (payload: unknown) => ({ eq: async () => { calls.push({ table, op: 'update', payload }); return { error: null } } }),
  })
  return { admin: { from, auth: { admin: { deleteUser } } } as unknown as ServiceClient, calls, deleteUser }
}

describe('deleteUserCompletely', () => {
  it('removes a regular user entirely, including the sign-in', async () => {
    const { admin, calls, deleteUser } = fakeAdmin(null)
    const r = await deleteUserCompletely(admin, 'u1', { keepStaffAccess: true })
    expect(r).toMatchObject({ ok: true, keptStaffAccess: false })
    expect(deleteUser).toHaveBeenCalledWith('u1')
    expect(calls.filter((c) => c.op === 'delete').map((c) => c.table)).toEqual(expect.arrayContaining([...USER_DATA_TABLES, 'profiles']))
  })

  it('empties the app account of a staff member but leaves the sign-in and every admin record alone', async () => {
    for (const role of ['admin', 'owner']) {
      const { admin, calls, deleteUser } = fakeAdmin(role)
      const r = await deleteUserCompletely(admin, 'u1', { keepStaffAccess: true })
      expect(r).toMatchObject({ ok: true, keptStaffAccess: true })
      expect(deleteUser).not.toHaveBeenCalled()
      const touched = calls.map((c) => c.table)
      expect(touched).toEqual(expect.arrayContaining([...USER_DATA_TABLES, 'profiles', 'sms_ingest_tokens', 'push_tokens']))
      expect(calls.some((c) => c.table === 'profiles' && c.op === 'delete')).toBe(false)
      expect(touched.some((t) => t.startsWith('admin_'))).toBe(false)
      expect(calls.find((c) => c.table === 'profiles')?.payload).toMatchObject({ data_reset_at: expect.any(String), financial_profile: null })
    }
  })

  it('the admin portal still removes a staff member (their account is the target, not their own choice)', async () => {
    const { admin, deleteUser } = fakeAdmin('support_agent')
    expect(await deleteUserCompletely(admin, 'u1')).toMatchObject({ ok: true, keptStaffAccess: false })
    expect(deleteUser).toHaveBeenCalled()
  })

  it('never deletes the owner through the portal path', async () => {
    const { admin, calls, deleteUser } = fakeAdmin('owner')
    expect(await deleteUserCompletely(admin, 'u1')).toMatchObject({ ok: false })
    expect(deleteUser).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })

  it('a reset or a staff self-delete also clears receipts, snapshots and chat history', () => {
    for (const t of ['receipts', 'net_worth_snapshots', 'savings_month_summary', 'goal_allocation_runs', 'ai_chats', 'sms_parse_log']) {
      expect(USER_DATA_TABLES).toContain(t)
    }
  })
})

