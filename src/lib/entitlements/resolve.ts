import { LIMIT_CATALOG, LIMIT_KEYS, type LimitKey } from './limits'

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
  if (entitlement) {
    if (status === 'trialing' && lapsed(entitlement.trial_ends_at, now)) status = 'expired'
    if (status === 'active' && entitlement.current_period_end && lapsed(entitlement.current_period_end, now)) status = 'expired'
  }

  const grantsPlan = !!entitlement && (status === 'active' || status === 'trialing' || status === 'past_due')
  const plan = (grantsPlan && plans.get(entitlement!.plan_key)) || defaultPlan

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
