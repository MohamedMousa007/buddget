import { describe, expect, it, vi } from 'vitest'
import { deleteUserCompletely } from './deleteAccount'
import { ACCOUNT_TABLES, SIGN_IN_TABLES, USER_DATA_TABLES, removeAvatarObject } from './userData'
import type { ServiceClient } from '@/lib/supabase/service'

const tickets = [{ id: 't-help', kind: 'support' }, { id: 't-bug', kind: 'bug' }, { id: 't-feat', kind: 'feature' }, { id: 't-bill', kind: 'billing' }]

function fakeAdmin(staffRole: string | null, opts: { deleteUserError?: string; failTable?: string } = {}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = []
  const deleteUser = vi.fn(async () => { calls.push({ table: 'auth', op: 'deleteUser' }); return { error: opts.deleteUserError ? { message: opts.deleteUserError } : null } })
  const getUserById = vi.fn(async () => ({ data: { user: { email: 'a@x.com' } } }))
  const from = (table: string) => ({
    select: () => ({
      eq: () => Object.assign(Promise.resolve({ data: table === 'support_tickets' ? tickets : [], error: null }), {
        maybeSingle: async () => ({ data: table === 'admin_staff' && staffRole ? { role_key: staffRole } : null }),
      }),
    }),
    delete: () => ({ eq: async () => { calls.push({ table, op: 'delete' }); return { error: table === opts.failTable ? { message: 'boom' } : null } } }),
    update: (payload: unknown) => ({
      eq: async () => { calls.push({ table, op: 'update', payload }); return { error: null } },
      in: async (_c: string, ids: string[]) => { calls.push({ table, op: 'update', payload: { ...(payload as object), ids } }); return { error: null } },
    }),
  })
  return { admin: { from, auth: { admin: { deleteUser, getUserById } } } as unknown as ServiceClient, calls, deleteUser }
}

describe('deleteUserCompletely', () => {
  it('removes a regular user entirely, including the sign-in', async () => {
    const { admin, calls, deleteUser } = fakeAdmin(null)
    const r = await deleteUserCompletely(admin, 'u1', { keepStaffAccess: true })
    expect(r).toMatchObject({ ok: true, keptStaffAccess: false })
    expect(deleteUser).toHaveBeenCalledWith('u1')
    expect(calls.filter((c) => c.op === 'delete').map((c) => c.table)).toEqual(expect.arrayContaining([...USER_DATA_TABLES, 'profiles']))
  })

  it('scrubs personal text, then deletes the sign-in first, then sweeps account tables', async () => {
    const { admin, calls, deleteUser } = fakeAdmin(null)
    await deleteUserCompletely(admin, 'u1', { keepStaffAccess: true })
    const firstWipe = calls.findIndex((c) => c.op === 'delete' && c.table !== 'site_leads')
    expect(calls.findIndex((c) => c.table === 'email_log' && c.op === 'update')).toBeLessThan(firstWipe)
    expect(calls.find((c) => c.table === 'email_log')?.payload).toEqual({ to_email: '[erased]' })
    expect(calls.find((c) => c.table === 'support_tickets')?.payload).toMatchObject({ requester_email: null })
    expect(calls.findIndex((c) => c.op === 'deleteUser')).toBeLessThan(firstWipe)
    const deleted = calls.filter((c) => c.op === 'delete').map((c) => c.table)
    for (const { table } of [...ACCOUNT_TABLES, ...SIGN_IN_TABLES]) expect(deleted).toContain(table)
  })

  it('ADS-7: removes the website leads sent from the account address (self-service and admin delete share this path)', async () => {
    const { admin, calls } = fakeAdmin(null)
    await deleteUserCompletely(admin, 'u1')
    expect(calls.filter((c) => c.table === 'site_leads' && c.op === 'delete')).toHaveLength(1)
    const staff = fakeAdmin('admin')
    await deleteUserCompletely(staff.admin, 'u1', { keepStaffAccess: true })
    expect(staff.calls.some((c) => c.table === 'site_leads' && c.op === 'delete')).toBe(true)
  })

  it('blanks the text of private tickets, keeps bug and feature tickets as history', async () => {
    const { admin, calls } = fakeAdmin(null)
    await deleteUserCompletely(admin, 'u1')
    const erased = calls.filter((c) => c.table === 'support_tickets' && (c.payload as { subject?: string })?.subject === '[deleted]')
    expect(erased.length).toBeGreaterThan(0)
    for (const e of erased) expect((e.payload as { ids: string[] }).ids).toEqual(['t-help', 't-bill'])
    const bodies = calls.filter((c) => c.table === 'support_ticket_messages')
    expect(bodies.every((b) => (b.payload as { ids: string[] }).ids.join() === 't-help,t-bill')).toBe(true)
  })

  it('keeps the account and wipes nothing when the sign-in cannot be deleted', async () => {
    const { admin, calls } = fakeAdmin(null, { deleteUserError: 'nope' })
    const r = await deleteUserCompletely(admin, 'u1')
    expect(r).toMatchObject({ ok: false, error: 'Failed to delete auth user' })
    expect(calls.some((c) => c.op === 'delete' && c.table !== 'site_leads')).toBe(false)
  })

  it('reports rows the sweep could not remove instead of hiding them', async () => {
    const { admin } = fakeAdmin(null, { failTable: 'push_tokens' })
    const r = await deleteUserCompletely(admin, 'u1')
    expect(r).toMatchObject({ ok: true })
    expect(r.ok && r.partialErrors).toEqual(['push_tokens: boom'])
  })

  it('a staff member emptying their app account keeps the sign-in credentials', async () => {
    const { admin, calls } = fakeAdmin('admin')
    await deleteUserCompletely(admin, 'u1', { keepStaffAccess: true })
    const deleted = calls.filter((c) => c.op === 'delete').map((c) => c.table)
    for (const { table } of ACCOUNT_TABLES) expect(deleted).toContain(table)
    for (const { table } of SIGN_IN_TABLES) expect(deleted).not.toContain(table)
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
      expect(touched.filter((t) => ['admin_staff', 'admin_credentials', 'admin_sessions', 'admin_biometric_devices'].includes(t))).toEqual([])
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
    for (const t of ['receipts', 'net_worth_snapshots', 'savings_month_summary', 'goal_allocation_runs', 'ai_chats', 'sms_parse_log', 'sms_template_users', 'sms_template_signals', 'sms_stats_outbox']) {
      expect(USER_DATA_TABLES).toContain(t)
    }
  })

  it('removes a stored avatar object and reports a failure instead of swallowing it', async () => {
    const remove = vi.fn(async () => ({ error: { message: 'denied' } }))
    const admin = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { avatar_image_path: 'u1/me.png' } }) }) }) }),
      storage: { from: () => ({ remove }) },
    } as unknown as ServiceClient
    expect(await removeAvatarObject(admin, 'u1')).toEqual(['avatar: denied'])
    expect(remove).toHaveBeenCalledWith(['u1/me.png'])
  })

  it('leaves storage alone when the avatar is a URL', async () => {
    const remove = vi.fn()
    const admin = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { avatar_image_path: 'https://x/y.png' } }) }) }) }),
      storage: { from: () => ({ remove }) },
    } as unknown as ServiceClient
    expect(await removeAvatarObject(admin, 'u1')).toEqual([])
    expect(remove).not.toHaveBeenCalled()
  })
})
