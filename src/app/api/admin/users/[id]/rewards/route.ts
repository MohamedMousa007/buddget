import { can } from '@/lib/admin/permissions'
import { parseRewardsOp, REWARDS_READ_PERMISSIONS, REWARDS_WRITE_PERMISSIONS, sparksBuckets, STATUS_MESSAGES, type RewardsOp, type SparksLedger } from '@/lib/admin/rewardsOps'
import { rewardsAdmin, type AdminResult } from '@/lib/server/rewardsAdmin'
import { bad, guardAdmin, json, readJson, type AdminContext } from '@/lib/server/admin/guard'
import { blockedTarget, UUID_RE } from '@/lib/server/admin/targets'

type Params = { params: Promise<{ id: string }> }

/** A user's whole Pro, Sparks, loyalty and invite state in one request. Sparks and invites only for the staff who manage them. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: REWARDS_READ_PERMISSIONS })
  if (!g.ok) return g.res
  const { ctx } = g
  const admin = rewardsAdmin(ctx.service, ctx.user.id)
  const seeSparks = can(ctx.permissions, 'sparks.manage')
  const seeInvites = can(ctx.permissions, 'referrals.manage')

  const [ent, account, founder, banked, tiers, ledger, referrals] = await Promise.all([
    ctx.service.from('user_entitlements').select('plan_key, status, source, store, trial_ends_at, current_period_end, will_renew, note, updated_at').eq('user_id', id).maybeSingle(),
    ctx.service.from('loyalty_accounts').select('points_balance, lifetime_points, tier_key, tier_locked, streak_weeks, streak_best, freezes_banked, last_kept_week, multiplier_step').eq('user_id', id).maybeSingle(),
    ctx.service.from('founders').select('number, cohort, granted_at, retired_at, credit_name_status').eq('user_id', id).maybeSingle(),
    ctx.service.from('pro_promo_grants').select('days').eq('user_id', id).is('started_at', null).is('revoked_at', null).limit(100),
    ctx.service.from('loyalty_tiers').select('key, name, min_points, requires_pro, requires_founder, sparks_gift').order('min_points'),
    seeSparks ? admin.sparksLedger(id, 20) : Promise.resolve(null),
    seeInvites ? admin.referralsFor(id) : Promise.resolve(null),
  ])
  if (ent.error || account.error || founder.error || banked.error || tiers.error) return bad('Could not load membership and rewards.', 500)
  if (ledger?.status === 'error' || referrals?.status === 'error') return bad('Could not load membership and rewards.', 500)

  const sparks = ledger as unknown as SparksLedger | null
  return json({
    entitlement: ent.data ?? null,
    bankedProDays: (banked.data ?? []).reduce((s, r) => s + r.days, 0),
    loyalty: account.data ?? null,
    founder: founder.data ?? null,
    tiers: tiers.data ?? [],
    sparks: sparks ? { available: sparks.available, buckets: sparksBuckets(sparks), allowances: sparks.allowances, purchases: sparks.purchases, spend: sparks.spend } : null,
    referrals: referrals ?? null,
  })
}

/** One action per request. Every write is audit-logged by its SQL function. */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: REWARDS_WRITE_PERMISSIONS })
  if (!g.ok) return g.res
  const { ctx } = g

  const parsed = parseRewardsOp(await readJson(req))
  if (!parsed.ok) return bad(parsed.error)
  if (!can(ctx.permissions, parsed.permission)) return bad('Your role does not allow this.', 403)
  const blocked = await blockedTarget(ctx, id, { allowSelf: true })
  if (blocked) return bad(blocked, 403)

  const op = parsed.value
  if ('referralId' in op) {
    const { data } = await ctx.service.from('referrals').select('id').eq('id', op.referralId).or(`inviter_id.eq.${id},invitee_id.eq.${id}`).maybeSingle()
    if (!data) return bad('That invite does not belong to this user.', 404)
  }

  const result = await perform(ctx, id, op)
  if (result.status === 'error') return bad('Could not complete that. Nothing was changed.', 500)
  if (result.status === 'ok') return json({ ...result, ok: true })
  // Invite actions answer with the invite's new state (rewarded, capped, rejected, revoked): the action ran.
  if ('referralId' in op && !['not_found', 'not_pending', 'invalid'].includes(result.status)) return json({ ok: true, outcome: result.status })
  const message = STATUS_MESSAGES[result.status]
  return bad(message ?? `Not done: ${result.status}.`, result.status === 'invalid' ? 400 : 409)
}

async function perform(ctx: AdminContext, id: string, op: RewardsOp): Promise<AdminResult> {
  const admin = rewardsAdmin(ctx.service, ctx.user.id)
  switch (op.op) {
    case 'grant_pro': return admin.grantPro(id, op.endsAt, op.note ?? undefined)
    case 'remove_pro': return admin.removePro(id, op.note ?? undefined)
    case 'start_trial': return admin.startTrial(id, op.days)
    case 'end_trial': return admin.endTrial(id)
    case 'bank_days': return admin.bankProDays(id, op.days)
    case 'unbank_days': {
      const { data, error } = await ctx.service.rpc('admin_rewards_unbank_pro_days', { p_actor: ctx.user.id, p_user: id })
      return error ? { status: 'error', message: error.message } : ((data ?? { status: 'error' }) as AdminResult)
    }
    case 'adjust_sparks': return admin.adjustSparks(id, op.amount, op.bucket, op.reason)
    case 'set_tier': return admin.setTier(id, op.tier, op.locked)
    case 'add_freezes': return admin.addFreezes(id, op.count)
    case 'set_streak': return admin.setStreak(id, op.weeks)
    case 'set_founder': return admin.setFounder(id, op.number)
    case 'remove_founder': return admin.removeFounder(id)
    case 'reset_loyalty': return admin.resetLoyalty(id)
    case 'approve_referral': return admin.approveReferral(op.referralId)
    case 'revoke_referral': return admin.revokeReferral(op.referralId)
    case 'mark_referral_activated': return admin.markReferralActivated(op.referralId)
  }
}
