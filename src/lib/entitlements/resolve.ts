import { LIMIT_CATALOG, LIMIT_KEYS, PAID_FEATURES, type LimitKey } from './limits'

export type EntitlementStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'paused'

export interface PlanRecord {
  key: string
  name: string
  limits: Record<string, unknown>
  features: readonly string[]
  trial_days: number
}

export interface EntitlementRecord {
  plan_key: string
  status: EntitlementStatus
  trial_ends_at: string | null
  current_period_end: string | null
  /** The store's grace expiry on a billing issue (S5c item 14); null falls back to the period end plus three days. */
  grace_ends_at?: string | null
  limit_overrides: Record<string, unknown>
  feature_overrides: Record<string, unknown>
}

export interface ResolvedEntitlements {
  planKey: string
  planName: string
  /** Status after applying dates: a lapsed trial or period reads as `expired`. */
  status: EntitlementStatus
  trialEndsAt: string | null
  limits: Record<LimitKey, number | null>
  features: string[]
}

function asLimit(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
  return undefined
}

function lapsed(iso: string | null, now: number): boolean {
  return !!iso && new Date(iso).getTime() <= now
}

const GRACE_FALLBACK_MS = 3 * 86_400_000

/**
 * Whether a status still grants its plan right now. The same rule as the SQL `entitlement_grants`, pinned by the one case
 * table in `entitlementStatusCases.ts`: a canceled plan keeps access to the end of the paid period, a past_due plan to the
 * store's grace expiry (or three days after the period end when none was reported), a lapsed trial or period grants nothing.
 */
export function grantsPlan(
  e: Pick<EntitlementRecord, 'status' | 'trial_ends_at' | 'current_period_end'> & { grace_ends_at?: string | null },
  now: number,
): boolean {
  switch (e.status) {
    case 'trialing': return !lapsed(e.trial_ends_at, now)
    case 'active': return !lapsed(e.current_period_end, now)
    case 'canceled': return !!e.current_period_end && !lapsed(e.current_period_end, now)
    case 'past_due': {
      const until = e.grace_ends_at ?? (e.current_period_end ? new Date(new Date(e.current_period_end).getTime() + GRACE_FALLBACK_MS).toISOString() : null)
      return !lapsed(until, now)
    }
    default: return false
  }
}

/**
 * What a user may do right now. Precedence for each limit: individual override, then the plan the user is
 * entitled to, then the platform fallback. A lapsed trial or paid period drops the user to the default plan,
 * which is how a trial ending or a membership expiring takes effect without a background job.
 */
export function resolveEntitlements(
  defaultPlan: PlanRecord,
  entitlement: EntitlementRecord | null,
  plans: ReadonlyMap<string, PlanRecord>,
  now = Date.now(),
): ResolvedEntitlements {
  let status: EntitlementStatus = entitlement?.status ?? 'active'
  const grants = !!entitlement && grantsPlan(entitlement, now)
  if (entitlement && !grants && (status === 'trialing' || status === 'active' || status === 'canceled' || status === 'past_due')) status = 'expired'
  const plan = (grants && plans.get(entitlement!.plan_key)) || defaultPlan

  const limits = {} as Record<LimitKey, number | null>
  for (const key of LIMIT_KEYS) {
    const override = entitlement ? asLimit(entitlement.limit_overrides?.[key]) : undefined
    const fromPlan = asLimit(plan.limits[key])
    limits[key] = override !== undefined ? override : fromPlan !== undefined ? fromPlan : LIMIT_CATALOG[key].fallback
  }

  const features = new Set(plan.features)
  for (const [name, on] of Object.entries(entitlement?.feature_overrides ?? {})) {
    if (on === true) features.add(name)
    else if (on === false) features.delete(name)
  }

  return {
    planKey: plan.key,
    planName: plan.name,
    status,
    trialEndsAt: entitlement?.trial_ends_at ?? null,
    limits,
    features: [...features],
  }
}

export type FeatureDecision = 'allow' | 'deny' | 'unavailable'

/** `planFeatures` is null when the entitlement read failed: a paid key then cannot be decided, an unpaid one keeps its default of allowed. */
export function decideFeature(
  key: string,
  override: unknown,
  planFeatures: readonly string[] | null,
  paid: ReadonlySet<string> = PAID_FEATURES,
): FeatureDecision {
  if (override === false) return 'deny'
  if (override === true || !paid.has(key)) return 'allow'
  if (planFeatures === null) return 'unavailable'
  return planFeatures.includes(key) ? 'allow' : 'deny'
}
