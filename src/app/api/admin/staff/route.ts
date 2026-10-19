import { OWNER_EMAIL, OWNER_ROLE, PERMISSIONS, can, isPermission, outranks, OWNER_ONLY } from '@/lib/admin/permissions'
import { bad, guardAdmin, json, readJson, type AdminContext } from '@/lib/server/admin/guard'
import { allowAttempt } from '@/lib/server/admin/credentials'
import { sendStaffInviteEmail } from '@/lib/server/admin/inviteEmail'
import { stepUp } from '@/lib/server/admin/stepUp'
import { revokeAllAdminSessions } from '@/lib/server/admin/session'
import { UUID_RE } from '@/lib/server/admin/targets'

const KEY_RE = /^[a-z][a-z0-9_]{1,31}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'staff.view' })
  if (!g.ok) return g.res
  const { service, role } = g.ctx
  const [staff, roles, creds, sessions] = await Promise.all([
    service.from('admin_staff').select('id, email, user_id, display_name, department, role_key, extra_permissions, status, created_at, last_login_at').order('created_at'),
    service.from('admin_roles').select('key, name, description, rank, permissions, is_system').order('rank'),
    service.from('admin_credentials').select('user_id, totp_confirmed_at'),
    service.from('admin_sessions').select('user_id').is('revoked_at', null).gt('expires_at', new Date().toISOString()),
  ])
  const secured = new Set((creds.data ?? []).filter((c) => c.totp_confirmed_at).map((c) => c.user_id))
  const live = new Map<string, number>()
  for (const s of sessions.data ?? []) live.set(s.user_id, (live.get(s.user_id) ?? 0) + 1)
  return json({
    staff: (staff.data ?? []).map((s) => ({ ...s, secured: !!s.user_id && secured.has(s.user_id), liveSessions: s.user_id ? (live.get(s.user_id) ?? 0) : 0, isOwner: s.role_key === OWNER_ROLE })),
    roles: roles.data ?? [],
    permissions: PERMISSIONS,
    ownerOnly: OWNER_ONLY,
    actorRank: role.rank,
    ownerEmail: OWNER_EMAIL,
  })
}

/** Sends the sign-in link, within limits that stop the mailer being used to spam someone. */
async function emailInvite(ctx: AdminContext, email: string): Promise<boolean> {
  const allowed =
    (await allowAttempt(ctx.service, `admin-invite-by:${ctx.staff.id}`, 3600, 30)) &&
    (await allowAttempt(ctx.service, `admin-invite-to:${email}`, 3600, 5))
  const sent = allowed && (await sendStaffInviteEmail(ctx.service, email))
  await ctx.audit(sent ? 'staff.invite_email' : 'staff.invite_email_failed', { targetType: 'staff', targetId: email, summary: sent ? `Emailed an invite to ${email}` : `Could not email ${email}` })
  return sent
}

async function roleRank(ctx: AdminContext, key: string): Promise<{ rank: number; permissions: string[] } | null> {
  const { data } = await ctx.service.from('admin_roles').select('rank, permissions').eq('key', key).maybeSingle()
  return data
}

/** A non-owner can only hand out permissions they hold themselves. */
function heldBy(ctx: AdminContext, perms: readonly string[]): boolean {
  return ctx.role.key === OWNER_ROLE || perms.every((p) => isPermission(p) && can(ctx.permissions, p))
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'staff.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{
    op?: string
    id?: string
    code?: string
    email?: string
    displayName?: string
    department?: string
    roleKey?: string
    extraPermissions?: string[]
    sendEmail?: boolean
    role?: { key: string; name: string; description?: string; permissions: string[]; rank?: number }
    key?: string
  }>(req)
  if (!body?.op) return bad('Unknown action.')

  if (body.op === 'invite') {
    const email = body.email?.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) return bad('Enter a valid email address.')
    if (email === OWNER_EMAIL) return bad('That account is already the owner.')
    const target = body.roleKey ? await roleRank(ctx, body.roleKey) : null
    if (!target || body.roleKey === OWNER_ROLE) return bad('Pick a role.')
    if (!outranks(ctx.role.rank, target.rank)) return bad('You can only assign roles below your own.', 403)
    const extra = (body.extraPermissions ?? []).filter(isPermission)
    if (!heldBy(ctx, extra)) return bad('You can only grant permissions you hold.', 403)
    const { error } = await ctx.service.from('admin_staff').insert({
      email,
      display_name: body.displayName?.trim().slice(0, 60) || null,
      department: body.department?.trim().slice(0, 40) || null,
      role_key: body.roleKey!,
      extra_permissions: extra,
      invited_by: ctx.staff.id,
    })
    if (error) return bad(error.code === '23505' ? 'That person is already on the team.' : 'Could not add them.', error.code === '23505' ? 409 : 500)
    await ctx.audit('staff.invite', { targetType: 'staff', targetId: email, summary: `Added ${email} as ${body.roleKey}` })
    if (body.sendEmail === false) return json({ ok: true, emailSent: false })
    return json({ ok: true, emailSent: await emailInvite(ctx, email) })
  }

  if (body.op === 'upsert_role') {
    const r = body.role
    if (!r || !KEY_RE.test(r.key) || r.key === OWNER_ROLE) return bad('Role keys use lowercase letters, numbers and underscores.')
    if (!r.name?.trim()) return bad('Give the role a name.')
    const perms = (r.permissions ?? []).filter(isPermission).filter((p) => !(OWNER_ONLY as readonly string[]).includes(p))
    if (!heldBy(ctx, perms)) return bad('You can only grant permissions you hold.', 403)
    const rank = Math.floor(r.rank ?? 50)
    if (!outranks(ctx.role.rank, rank)) return bad('A custom role must rank below your own.', 403)
    const { data: existing } = await ctx.service.from('admin_roles').select('is_system, rank').eq('key', r.key).maybeSingle()
    if (existing?.is_system) return bad('System roles cannot be edited.', 403)
    if (existing && !outranks(ctx.role.rank, existing.rank)) return bad('You cannot edit a role at or above your level.', 403)
    if (!(await stepUp(ctx, body.code))) return bad('Enter a valid authenticator code to confirm.', 401)
    const { error } = await ctx.service.from('admin_roles').upsert({ key: r.key, name: r.name.trim().slice(0, 40), description: (r.description ?? '').slice(0, 200), rank, permissions: perms, is_system: false })
    if (error) return bad('Could not save the role.', 500)
    await ctx.audit('staff.role_upsert', { targetType: 'role', targetId: r.key, summary: `Saved role ${r.key}`, metadata: { permissions: perms, rank } })
    return json({ ok: true })
  }

  if (body.op === 'delete_role' && body.key) {
    const { data: role } = await ctx.service.from('admin_roles').select('is_system, rank').eq('key', body.key).maybeSingle()
    if (!role || role.is_system) return bad('System roles cannot be deleted.', 403)
    if (!outranks(ctx.role.rank, role.rank)) return bad('You cannot delete a role at or above your level.', 403)
    const { count } = await ctx.service.from('admin_staff').select('id', { count: 'exact', head: true }).eq('role_key', body.key)
    if (count) return bad(`${count} staff member(s) hold this role.`)
    await ctx.service.from('admin_roles').delete().eq('key', body.key)
    await ctx.audit('staff.role_delete', { targetType: 'role', targetId: body.key, summary: `Deleted role ${body.key}` })
    return json({ ok: true })
  }

  if (!body.id || !UUID_RE.test(body.id)) return bad('Unknown staff member.')
  const { data: member } = await ctx.service.from('admin_staff').select('id, email, user_id, role_key, extra_permissions, status').eq('id', body.id).maybeSingle()
  if (!member) return bad('Staff member not found.', 404)
  if (member.role_key === OWNER_ROLE) return bad('The owner account cannot be changed.', 403)
  const memberRole = await roleRank(ctx, member.role_key)
  if (!memberRole || !outranks(ctx.role.rank, memberRole.rank)) return bad('That person is at or above your level.', 403)
  const target = { targetType: 'staff', targetId: member.email }

  if (body.op === 'resend_invite') {
    if (member.status !== 'active') return bad('Restore this person before inviting them again.')
    return json({ ok: true, emailSent: await emailInvite(ctx, member.email) })
  }

  if (body.op === 'update') {
    const patch: { role_key?: string; extra_permissions?: string[]; display_name?: string | null; department?: string | null } = {}
    if (body.roleKey !== undefined) {
      const next = await roleRank(ctx, body.roleKey)
      if (!next || body.roleKey === OWNER_ROLE) return bad('Pick a role.')
      if (!outranks(ctx.role.rank, next.rank)) return bad('You can only assign roles below your own.', 403)
      patch.role_key = body.roleKey
    }
    if (body.extraPermissions !== undefined) {
      const extra = body.extraPermissions.filter(isPermission)
      if (!heldBy(ctx, extra)) return bad('You can only grant permissions you hold.', 403)
      patch.extra_permissions = extra
    }
    if (body.displayName !== undefined) patch.display_name = body.displayName.trim().slice(0, 60) || null
    if (body.department !== undefined) patch.department = body.department.trim().slice(0, 40) || null
    if (Object.keys(patch).length === 0) return bad('Nothing to change.')
    if ((patch.role_key || patch.extra_permissions) && !(await stepUp(ctx, body.code))) return bad('Enter a valid authenticator code to confirm.', 401)
    const { error } = await ctx.service.from('admin_staff').update(patch).eq('id', member.id)
    if (error) return bad('Could not update.', 500)
    if (patch.role_key || patch.extra_permissions) {
      if (member.user_id) await revokeAllAdminSessions(ctx.service, member.user_id)
    }
    await ctx.audit('staff.update', { ...target, summary: `Updated ${member.email}`, metadata: patch })
    return json({ ok: true })
  }

  if (body.op === 'suspend' || body.op === 'restore') {
    const status = body.op === 'suspend' ? 'suspended' : 'active'
    await ctx.service.from('admin_staff').update({ status }).eq('id', member.id)
    if (status === 'suspended' && member.user_id) await revokeAllAdminSessions(ctx.service, member.user_id)
    await ctx.audit(`staff.${body.op}`, { ...target, summary: `${body.op === 'suspend' ? 'Suspended' : 'Restored'} ${member.email}` })
    return json({ ok: true })
  }

  if (body.op === 'reset_credentials') {
    if (!(await stepUp(ctx, body.code))) return bad('Enter a valid authenticator code to confirm.', 401)
    if (member.user_id) {
      await revokeAllAdminSessions(ctx.service, member.user_id)
      await ctx.service.from('admin_credentials').delete().eq('user_id', member.user_id)
      await ctx.service.from('admin_biometric_devices').delete().eq('user_id', member.user_id)
    }
    await ctx.audit('staff.reset_credentials', { ...target, summary: `Reset security for ${member.email}; they must set up again` })
    return json({ ok: true })
  }

  if (body.op === 'remove') {
    if (!(await stepUp(ctx, body.code))) return bad('Enter a valid authenticator code to confirm.', 401)
    if (member.user_id) {
      await revokeAllAdminSessions(ctx.service, member.user_id)
      await ctx.service.from('admin_credentials').delete().eq('user_id', member.user_id)
      await ctx.service.from('admin_biometric_devices').delete().eq('user_id', member.user_id)
    }
    await ctx.service.from('admin_staff').delete().eq('id', member.id)
    await ctx.audit('staff.remove', { ...target, summary: `Removed ${member.email} from the team` })
    return json({ ok: true })
  }

  return bad('Unknown action.')
}

