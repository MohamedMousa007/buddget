import 'server-only'
import type { ServiceClient } from '@/lib/supabase/service'
import { resolveEntitlements, type EntitlementRecord, type PlanRecord, type ResolvedEntitlements } from './resolve'

/** Loads what `userId` is entitled to. Users with no entitlement row are on the default plan. */
export async function getUserEntitlements(service: ServiceClient, userId: string): Promise<ResolvedEntitlements> {
  const [{ data: plans }, { data: entitlement }] = await Promise.all([
    service.from('plans').select('key, name, limits, features, trial_days, is_default'),
    service.from('user_entitlements').select('plan_key, status, trial_ends_at, current_period_end, limit_overrides, feature_overrides').eq('user_id', userId).maybeSingle(),
  ])
  const records = new Map<string, PlanRecord>()
  for (const p of plans ?? []) {
    records.set(p.key, { key: p.key, name: p.name, limits: (p.limits ?? {}) as Record<string, unknown>, features: p.features, trial_days: p.trial_days })
  }
  const fallback = plans?.find((p) => p.is_default)
  const defaultPlan = fallback ? records.get(fallback.key)! : { key: 'free', name: 'Free', limits: {}, features: [], trial_days: 0 }
  return resolveEntitlements(
    defaultPlan,
    entitlement ? ({ ...entitlement, limit_overrides: (entitlement.limit_overrides ?? {}) as Record<string, unknown>, feature_overrides: (entitlement.feature_overrides ?? {}) as Record<string, unknown> } as EntitlementRecord) : null,
    records,
  )
}
