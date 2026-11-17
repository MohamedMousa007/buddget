import type { Permission } from './permissions'

/**
 * The admin portal's Pro, Sparks, loyalty and invite actions on one user (spec section 5): which permission each needs and
 * what a valid request looks like. Pure, so the route only maps a parsed action to its `rewardsAdmin` call.
 */
export type RewardsOp =
  | { op: 'grant_pro'; endsAt: string | null; note: string | null }
  | { op: 'remove_pro'; note: string | null }
  | { op: 'start_trial'; days: number }
  | { op: 'end_trial' }
  | { op: 'bank_days'; days: number }
  | { op: 'unbank_days' }
  | { op: 'adjust_sparks'; amount: number; bucket: 'reward' | 'purchased'; reason: string }
  | { op: 'set_tier'; tier: string | null; locked: boolean }
  | { op: 'add_freezes'; count: number }
  | { op: 'set_streak'; weeks: number }
  | { op: 'set_founder'; number: number | null }
  | { op: 'remove_founder' }
  | { op: 'reset_loyalty' }
  | { op: 'approve_referral' | 'revoke_referral' | 'mark_referral_activated'; referralId: number }

export const REWARDS_OP_PERMISSION: Record<RewardsOp['op'], Permission> = {
  grant_pro: 'billing.grant',
  remove_pro: 'billing.grant',
  start_trial: 'billing.grant',
  end_trial: 'billing.grant',
  bank_days: 'billing.grant',
  unbank_days: 'billing.grant',
  adjust_sparks: 'sparks.manage',
  set_tier: 'loyalty.manage',
  add_freezes: 'loyalty.manage',
  set_streak: 'loyalty.manage',
  set_founder: 'loyalty.manage',
  remove_founder: 'loyalty.manage',
  reset_loyalty: 'loyalty.manage',
  approve_referral: 'referrals.manage',
  revoke_referral: 'referrals.manage',
  mark_referral_activated: 'referrals.manage',
}

/** Any one of these opens the user's rewards state. */
export const REWARDS_READ_PERMISSIONS: readonly Permission[] = ['billing.view', 'billing.grant', 'sparks.manage', 'loyalty.view', 'loyalty.manage', 'referrals.manage']
export const REWARDS_WRITE_PERMISSIONS: readonly Permission[] = ['billing.grant', 'sparks.manage', 'loyalty.manage', 'referrals.manage']

export const SWITCH_KEYS = ['billing', 'tiers', 'referrals', 'spark_gifts'] as const
export type RewardsSwitch = (typeof SWITCH_KEYS)[number]
export const SWITCH_PERMISSION: Record<RewardsSwitch, Permission> = {
  billing: 'billing.grant',
  tiers: 'loyalty.manage',
  referrals: 'referrals.manage',
  spark_gifts: 'sparks.manage',
}
export const isSwitchKey = (v: unknown): v is RewardsSwitch => typeof v === 'string' && (SWITCH_KEYS as readonly string[]).includes(v)

const TIER_RE = /^[a-z][a-z0-9_]{1,31}$/
const MAX_PRO_GRANT_MS = 5 * 366 * 86_400_000

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null
const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export type Parsed = { ok: true; value: RewardsOp; permission: Permission } | { ok: false; error: string }

export function parseRewardsOp(body: unknown, now = Date.now()): Parsed {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Unknown action.' }
  const b = body as Record<string, unknown>
  const op = b.op
  if (typeof op !== 'string' || !Object.hasOwn(REWARDS_OP_PERMISSION, op)) return { ok: false, error: 'Unknown action.' }
  const value = build(op as RewardsOp['op'], b, now)
  if (typeof value === 'string') return { ok: false, error: value }
  return { ok: true, value, permission: REWARDS_OP_PERMISSION[value.op] }
}

function build(op: RewardsOp['op'], b: Record<string, unknown>, now: number): RewardsOp | string {
  switch (op) {
    case 'grant_pro': {
      if (b.endsAt === null || b.endsAt === undefined) return { op, endsAt: null, note: text(b.note, 300) }
      const at = typeof b.endsAt === 'string' ? Date.parse(b.endsAt) : NaN
      if (!Number.isFinite(at) || at <= now || at - now > MAX_PRO_GRANT_MS) return 'Pick an end date in the future (within five years), or until removed.'
      return { op, endsAt: new Date(at).toISOString(), note: text(b.note, 300) }
    }
    case 'remove_pro':
      return { op, note: text(b.note, 300) }
    case 'start_trial': {
      const days = int(b.days, 1, 90)
      return days === null ? 'A trial is 1 to 90 days.' : { op, days }
    }
    case 'bank_days': {
      const days = int(b.days, 1, 366)
      return days === null ? 'Bank 1 to 366 days.' : { op, days }
    }
    case 'adjust_sparks': {
      const amount = int(b.amount, -100_000, 100_000)
      if (!amount) return 'Enter a non-zero number of Sparks (up to 100,000).'
      if (b.bucket !== 'reward' && b.bucket !== 'purchased') return 'Pick the reward or purchased bucket.'
      const reason = text(b.reason, 300)
      if (!reason) return 'A reason is required.'
      return { op, amount, bucket: b.bucket, reason }
    }
    case 'set_tier': {
      if (typeof b.locked !== 'boolean') return 'Say whether the tier is locked.'
      if (b.tier !== null && (typeof b.tier !== 'string' || !TIER_RE.test(b.tier))) return 'Unknown tier.'
      return { op, tier: b.tier as string | null, locked: b.locked }
    }
    case 'add_freezes': {
      const count = int(b.count, -2, 2)
      return !count ? 'Add or remove 1 or 2 freezes.' : { op, count }
    }
    case 'set_streak': {
      const weeks = int(b.weeks, 0, 520)
      return weeks === null ? 'A streak is 0 to 520 weeks.' : { op, weeks }
    }
    case 'set_founder': {
      if (b.number === null || b.number === undefined) return { op, number: null }
      const number = int(b.number, 1, 9999)
      return number === null ? 'A founder number is a whole number from 1.' : { op, number }
    }
    case 'approve_referral':
    case 'revoke_referral':
    case 'mark_referral_activated': {
      const referralId = int(b.referralId, 1, Number.MAX_SAFE_INTEGER)
      return referralId === null ? 'Pick one invite.' : { op, referralId }
    }
    default:
      return { op } as RewardsOp
  }
}

/** Plain-language answers for the statuses the SQL functions return besides `ok`. */
export const STATUS_MESSAGES: Record<string, string> = {
  invalid: 'The database refused those values.',
  no_plan: 'This user has no plan to remove; they are already on Free.',
  not_trialing: 'This user is not on a trial.',
  nothing_banked: 'This user has no banked Pro days.',
  unknown_tier: 'That tier does not exist.',
  number_taken: 'That founder number belongs to someone else.',
  cap_reached: 'That number is past the founder cap.',
  not_founder: 'This user is not a founder.',
  not_found: 'That invite no longer exists.',
  not_pending: 'That invite is not pending or expired, so it cannot be marked activated.',
}

export interface SparksLedger {
  available: number
  allowances: Array<{ id: string; kind: string; granted: number; used: number; period_start: string; period_end: string; ref: string | null; reason: string | null }>
  purchases: Array<{ id: string; store: string; product_id: string; sparks: number; bonus_sparks: number; remaining: number; purchased_at: string; refunded_at: string | null }>
  spend: Array<{ feature: string; sparks: number; created_at: string }>
}

/** What is spendable now, per bucket: each open allowance kind, plus purchased packs. */
export function sparksBuckets(ledger: SparksLedger, now = Date.now()): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of ledger.allowances) {
    if (Date.parse(a.period_start) > now || Date.parse(a.period_end) <= now) continue
    out[a.kind] = (out[a.kind] ?? 0) + Math.max(0, a.granted - a.used)
  }
  const purchased = ledger.purchases.filter((p) => !p.refunded_at).reduce((s, p) => s + p.remaining, 0)
  if (purchased) out.purchased = purchased
  return out
}
