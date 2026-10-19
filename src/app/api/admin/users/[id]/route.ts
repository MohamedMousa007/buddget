import { createClient } from '@supabase/supabase-js'
import { deleteUserCompletely } from '@/lib/server/deleteAccount'
import { emitNotification } from '@/lib/server/emitNotification'
import { sendNativePush } from '@/lib/server/sendNativePush'
import { isFeatureKey, isLimitKey } from '@/lib/entitlements/limits'
import { can, type Permission } from '@/lib/admin/permissions'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'
import { appOrigin } from '@/lib/apiBase'
import { bad, guardAdmin, json, maskEmail, readJson } from '@/lib/server/admin/guard'
import { stepUp } from '@/lib/server/admin/stepUp'
import { blockedTarget, UUID_RE } from '@/lib/server/admin/targets'
import type { Json } from '@/lib/supabase/database.types'

type Params = { params: Promise<{ id: string }> }

const FAR_FUTURE_BAN = '876000h'
const ENTITLEMENT_STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'expired', 'paused'] as const

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: 'users.view' })
  if (!g.ok) return g.res
  const { ctx } = g

  const [overview, notes, tickets, plans, staff, ledger] = await Promise.all([
    ctx.service.rpc('admin_user_overview', { p_user: id }),
    ctx.service.from('admin_user_notes').select('id, author_label, body, pinned, created_at').eq('user_id', id).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50),
    ctx.service.from('support_tickets').select('id, number, subject, status, priority, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(8),
    ctx.service.from('plans').select('key, name, status, is_default, trial_days').neq('status', 'archived').order('sort_order'),
    ctx.service.from('admin_staff').select('role_key').eq('user_id', id).maybeSingle(),
    ctx.service.from('loyalty_ledger').select('id, delta, reason, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
  ])
  if (overview.error || !overview.data) return bad('User not found.', 404)

  const data = overview.data as { auth: { email?: string; phone?: string } | null; profile: { phone?: string; city?: string } | null } & Record<string, unknown>
  if (!data.auth) return bad('User not found.', 404)
  if (!ctx.canSeePii) {
    data.auth.email = maskEmail(data.auth.email) ?? undefined
    data.auth.phone = undefined
    if (data.profile) { data.profile.phone = undefined; data.profile.city = undefined }
  }
  return json({
    ...data,
    notes: notes.data ?? [],
    tickets: tickets.data ?? [],
    plans: plans.data ?? [],
    staffRole: staff.data?.role_key ?? null,
    loyaltyLedger: ledger.data ?? [],
  })
}

type Op =
  | { op: 'note'; body: string; pinned?: boolean }
  | { op: 'suspend'; reason?: string }
  | { op: 'restore' }
  | { op: 'set_entitlement'; planKey: string; status: string; trialDays?: number; periodEnd?: string | null; note?: string }
  | { op: 'clear_entitlement' }
  | { op: 'set_limits'; limits: Record<string, number | null>; features?: Record<string, boolean> }
  | { op: 'notify'; title: string; body: string }
  | { op: 'test_push' }
  | { op: 'reset_sms_tokens' }
  | { op: 'clear_push_tokens' }
  | { op: 'clear_trusted_devices' }
  | { op: 'remove_biometric' }
  | { op: 'send_password_reset' }
  | { op: 'verify_email' }
  | { op: 'delete'; code: string }

const REQUIRES: Record<Op['op'], Permission> = {
  note: 'users.edit',
  suspend: 'users.suspend',
  restore: 'users.suspend',
  set_entitlement: 'billing.manage',
  clear_entitlement: 'billing.manage',
  set_limits: 'users.limits',
  notify: 'users.tools',
  test_push: 'users.tools',
  reset_sms_tokens: 'users.tools',
  clear_push_tokens: 'users.tools',
  clear_trusted_devices: 'users.tools',
  remove_biometric: 'users.tools',
  send_password_reset: 'users.tools',
  verify_email: 'users.edit',
  delete: 'users.delete',
}

const DESTRUCTIVE = new Set<Op['op']>(['suspend', 'delete', 'clear_entitlement'])

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<Op>(req)
  if (!body || typeof body.op !== 'string' || !(body.op in REQUIRES)) return bad('Unknown action.')
  if (!can(ctx.permissions, REQUIRES[body.op])) return bad('Your role does not allow this.', 403)

  const { data: target } = await ctx.service.auth.admin.getUserById(id)
  if (!target.user) return bad('User not found.', 404)
  const email = target.user.email ?? null

  if (DESTRUCTIVE.has(body.op) || body.op === 'remove_biometric') {
    const blocked = await blockedTarget(ctx, id)
    if (blocked) return bad(blocked, 403)
  }

  const log = (action: string, summary: string, metadata?: Record<string, unknown>) =>
    ctx.audit(action, { targetType: 'user', targetId: id, summary: `${summary} (${maskEmail(email)})`, metadata })

  switch (body.op) {
    case 'note': {
      const text = body.body?.trim()
      if (!text) return bad('Write a note first.')
      await ctx.service.from('admin_user_notes').insert({ user_id: id, staff_id: ctx.staff.id, author_label: ctx.staff.display_name ?? ctx.staff.email, body: text.slice(0, 5000), pinned: !!body.pinned })
      return json({ ok: true })
    }
    case 'suspend': {
      const { error } = await ctx.service.auth.admin.updateUserById(id, { ban_duration: FAR_FUTURE_BAN })
      if (error) return bad('Could not suspend the account.', 500)
      await log('user.suspend', 'Suspended user', { reason: body.reason?.slice(0, 300) })
      return json({ ok: true })
    }
    case 'restore': {
      const { error } = await ctx.service.auth.admin.updateUserById(id, { ban_duration: 'none' })
      if (error) return bad('Could not restore the account.', 500)
      await log('user.restore', 'Restored user')
      return json({ ok: true })
    }
    case 'set_entitlement': {
      if (!(ENTITLEMENT_STATUSES as readonly string[]).includes(body.status)) return bad('Invalid status.')
      const { data: plan } = await ctx.service.from('plans').select('key, trial_days').eq('key', body.planKey).maybeSingle()
      if (!plan) return bad('Unknown plan.')
      const trialDays = body.status === 'trialing' ? Math.min(Math.max(Math.floor(body.trialDays ?? plan.trial_days) || 14, 1), 365) : 0
      const trialEnds = body.status === 'trialing' ? new Date(Date.now() + trialDays * 86_400_000).toISOString() : null
      const periodEnd = body.periodEnd ? new Date(body.periodEnd) : null
      if (periodEnd && Number.isNaN(periodEnd.getTime())) return bad('Invalid period end.')
      const { error } = await ctx.service.from('user_entitlements').upsert({
        user_id: id,
        plan_key: plan.key,
        status: body.status as (typeof ENTITLEMENT_STATUSES)[number],
        source: 'admin',
        trial_ends_at: trialEnds,
        current_period_end: periodEnd?.toISOString() ?? null,
        canceled_at: body.status === 'canceled' ? new Date().toISOString() : null,
        note: body.note?.slice(0, 500) ?? null,
        granted_by: ctx.staff.id,
      })
      if (error) return bad('Could not save the membership.', 500)
      await log('billing.entitlement_set', `Set ${plan.key} / ${body.status}`, { plan: plan.key, status: body.status, trialDays: trialEnds ? trialDays : undefined })
      return json({ ok: true })
    }
    case 'clear_entitlement': {
      await ctx.service.from('user_entitlements').delete().eq('user_id', id)
      await log('billing.entitlement_cleared', 'Returned user to the default plan')
      return json({ ok: true })
    }
    case 'set_limits': {
      const limits: Record<string, number | null> = {}
      for (const [k, v] of Object.entries(body.limits ?? {})) {
        if (!isLimitKey(k)) return bad(`Unknown limit: ${k}`)
        if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return bad(`Invalid value for ${k}`)
        limits[k] = v === null ? null : Math.floor(v)
      }
      const features: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(body.features ?? {})) if (isFeatureKey(k) && typeof v === 'boolean') features[k] = v
      const { data: existing } = await ctx.service.from('user_entitlements').select('user_id').eq('user_id', id).maybeSingle()
      let error: { message: string } | null
      if (existing) {
        // Only the overrides change: plan, status and source belong to whoever granted the membership.
        ;({ error } = await ctx.service.from('user_entitlements').update({ limit_overrides: limits as Json, feature_overrides: features as Json, granted_by: ctx.staff.id }).eq('user_id', id))
      } else {
        const { data: def } = await ctx.service.from('plans').select('key').eq('is_default', true).single()
        ;({ error } = await ctx.service.from('user_entitlements').insert({ user_id: id, plan_key: def?.key ?? 'free', status: 'active', source: 'admin', limit_overrides: limits as Json, feature_overrides: features as Json, granted_by: ctx.staff.id }))
      }
      if (error) return bad('Could not save the limits.', 500)
      await log('user.limits_set', 'Changed user limits', { limits, features })
      return json({ ok: true })
    }
    case 'notify': {
      const title = body.title?.trim().slice(0, 80)
      const text = body.body?.trim().slice(0, 400)
      if (!title || !text) return bad('Add a title and a message.')
      await emitNotification(ctx.service, {
        userId: id,
        category: 'support_message',
        severity: 'info',
        dedupeKey: `support:${id}:${Date.now()}`,
        title,
        body: text,
      })
      await log('user.notify', 'Sent notification', { title })
      return json({ ok: true })
    }
    case 'test_push': {
      const result = await sendNativePush({ userId: id, title: 'Buddget', body: 'Push delivery is working ✓', data: { type: 'test' } })
      await log('user.test_push', 'Sent test push', { result })
      return json(result)
    }
    case 'reset_sms_tokens': {
      const { data } = await ctx.service.from('sms_ingest_tokens').update({ is_active: false }).eq('user_id', id).eq('is_active', true).select('id')
      await log('user.reset_sms_tokens', 'Revoked SMS ingest tokens', { count: data?.length ?? 0 })
      return json({ ok: true, revoked: data?.length ?? 0 })
    }
    case 'clear_push_tokens': {
      const { data } = await ctx.service.from('push_tokens').delete().eq('user_id', id).select('id')
      await log('user.clear_push_tokens', 'Cleared push tokens', { count: data?.length ?? 0 })
      return json({ ok: true, cleared: data?.length ?? 0 })
    }
    case 'clear_trusted_devices': {
      const { data } = await ctx.service.from('trusted_devices').delete().eq('user_id', id).select('device_id')
      await log('user.clear_trusted_devices', 'Cleared trusted devices', { count: data?.length ?? 0 })
      return json({ ok: true, cleared: data?.length ?? 0 })
    }
    case 'remove_biometric': {
      const { data } = await ctx.service.from('biometric_devices').delete().eq('user_id', id).select('device_id')
      await log('user.remove_biometric', 'Removed biometric devices', { count: data?.length ?? 0 })
      return json({ ok: true, cleared: data?.length ?? 0 })
    }
    case 'send_password_reset': {
      if (!email) return bad('This account has no email.')
      const probe = createClient(requireSupabaseUrl(), requireSupabasePublishableKey(), { auth: { persistSession: false, autoRefreshToken: false } })
      const { error } = await probe.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/reset-password/confirm` })
      if (error) return bad('The reset email could not be sent.', 502)
      await log('user.send_password_reset', 'Sent password reset email')
      return json({ ok: true })
    }
    case 'verify_email': {
      const { error } = await ctx.service.auth.admin.updateUserById(id, { email_confirm: true })
      if (error) return bad('Could not verify the email.', 500)
      await log('user.verify_email', 'Marked email verified')
      return json({ ok: true })
    }
    case 'delete': {
      if (!(await stepUp(ctx, body.code))) return bad('Enter a valid authenticator code to confirm.', 401)
      const result = await deleteUserCompletely(ctx.service, id)
      if (!result.ok) return bad(result.error, 500)
      await log('user.delete', 'Permanently deleted user', { partialErrors: result.partialErrors })
      return json({ ok: true })
    }
  }
}
