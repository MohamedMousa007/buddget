import 'server-only'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, type ServiceClient } from '@/lib/supabase/service'
import { PAID_FEATURES } from './limits'
import { decideFeature, resolveEntitlements, type EntitlementRecord, type PlanRecord, type ResolvedEntitlements } from './resolve'

async function loadEntitlements(service: ServiceClient, userId: string) {
  const [{ data: plans, error: plansError }, { data: entitlement, error: entitlementError }] = await Promise.all([
    service.from('plans').select('key, name, limits, features, trial_days, is_default'),
    service.from('user_entitlements').select('plan_key, status, trial_ends_at, current_period_end, limit_overrides, feature_overrides').eq('user_id', userId).maybeSingle(),
  ])
  const records = new Map<string, PlanRecord>()
  for (const p of plans ?? []) {
    records.set(p.key, { key: p.key, name: p.name, limits: (p.limits ?? {}) as Record<string, unknown>, features: p.features, trial_days: p.trial_days })
  }
  const fallback = plans?.find((p) => p.is_default)
  const defaultPlan = fallback ? records.get(fallback.key)! : { key: 'free', name: 'Free', limits: {}, features: [], trial_days: 0 }
  const record = entitlement ? ({ ...entitlement, limit_overrides: (entitlement.limit_overrides ?? {}) as Record<string, unknown>, feature_overrides: (entitlement.feature_overrides ?? {}) as Record<string, unknown> } as EntitlementRecord) : null
  return { resolved: resolveEntitlements(defaultPlan, record, records), featureOverrides: record?.feature_overrides ?? {}, failed: !!plansError || !!entitlementError }
}

/** Loads what `userId` is entitled to. Users with no entitlement row are on the default plan. */
export async function getUserEntitlements(service: ServiceClient, userId: string): Promise<ResolvedEntitlements> {
  return (await loadEntitlements(service, userId)).resolved
}

/**
 * The one server check behind a feature key. An override of false switches the feature off, true switches it on;
 * otherwise it is allowed unless the key is paid and the plan lacks it. Null means proceed, else the response to return.
 */
export async function requireFeature(
  userId: string,
  key: string,
  service: ServiceClient = createServiceRoleClient(),
  paid: ReadonlySet<string> = PAID_FEATURES,
): Promise<NextResponse | null> {
  if (!paid.has(key)) {
    const { data } = await service.from('user_entitlements').select('feature_overrides').eq('user_id', userId).maybeSingle()
    return decideFeature(key, (data?.feature_overrides as Record<string, unknown> | null)?.[key], null, paid) === 'deny'
      ? NextResponse.json({ error: 'feature_disabled', stage: 'quota' }, { status: 403 })
      : null
  }
  const { resolved, featureOverrides, failed } = await loadEntitlements(service, userId)
  const decision = decideFeature(key, featureOverrides[key], failed ? null : resolved.features, paid)
  if (decision === 'allow') return null
  return decision === 'deny'
    ? NextResponse.json({ error: 'feature_disabled', stage: 'quota' }, { status: 403 })
    : NextResponse.json({ error: 'unavailable', stage: 'quota' }, { status: 503 })
}
