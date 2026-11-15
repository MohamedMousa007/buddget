/**
 * The one table of status cases (S4 section 5, S5c item 14) that both rules must satisfy: `grantsPlan` in resolve.ts and the
 * SQL `public.entitlement_grants`. `resolve.test.ts` runs it against the TypeScript rule; the same rows were run against the
 * live SQL function (see docs/launch/S6-build.md). Change a rule in one place and a row here must change with it.
 */
export interface StatusCase {
  name: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'paused'
  trialEndsAt: string | null
  periodEnd: string | null
  graceEndsAt: string | null
  grants: boolean
}

/** Every row is evaluated at this moment. */
export const STATUS_CASES_NOW = '2026-12-10T12:00:00Z'

export const STATUS_CASES: readonly StatusCase[] = [
  { name: 'active, period still open', status: 'active', trialEndsAt: null, periodEnd: '2026-12-20T00:00:00Z', graceEndsAt: null, grants: true },
  { name: 'active, no end date', status: 'active', trialEndsAt: null, periodEnd: null, graceEndsAt: null, grants: true },
  { name: 'active, period over', status: 'active', trialEndsAt: null, periodEnd: '2026-12-09T00:00:00Z', graceEndsAt: null, grants: false },
  { name: 'trialing, trial still running', status: 'trialing', trialEndsAt: '2026-12-15T00:00:00Z', periodEnd: null, graceEndsAt: null, grants: true },
  { name: 'trialing, trial over', status: 'trialing', trialEndsAt: '2026-12-01T00:00:00Z', periodEnd: null, graceEndsAt: null, grants: false },
  { name: 'canceled, paid period still open keeps access', status: 'canceled', trialEndsAt: null, periodEnd: '2026-12-20T00:00:00Z', graceEndsAt: null, grants: true },
  { name: 'canceled, paid period over', status: 'canceled', trialEndsAt: null, periodEnd: '2026-12-09T00:00:00Z', graceEndsAt: null, grants: false },
  { name: 'canceled, no period end grants nothing', status: 'canceled', trialEndsAt: null, periodEnd: null, graceEndsAt: null, grants: false },
  { name: 'past_due, store grace still running (a Google 7 days)', status: 'past_due', trialEndsAt: null, periodEnd: '2026-12-05T00:00:00Z', graceEndsAt: '2026-12-12T00:00:00Z', grants: true },
  { name: 'past_due, store grace over', status: 'past_due', trialEndsAt: null, periodEnd: '2026-12-05T00:00:00Z', graceEndsAt: '2026-12-09T00:00:00Z', grants: false },
  { name: 'past_due, no grace reported: period end + 3 days not reached', status: 'past_due', trialEndsAt: null, periodEnd: '2026-12-08T00:00:00Z', graceEndsAt: null, grants: true },
  { name: 'past_due, no grace reported: period end + 3 days passed', status: 'past_due', trialEndsAt: null, periodEnd: '2026-12-06T00:00:00Z', graceEndsAt: null, grants: false },
  { name: 'past_due, a reported grace wins over the 3-day fallback', status: 'past_due', trialEndsAt: null, periodEnd: '2026-12-01T00:00:00Z', graceEndsAt: '2026-12-11T00:00:00Z', grants: true },
  { name: 'expired never grants', status: 'expired', trialEndsAt: null, periodEnd: '2026-12-20T00:00:00Z', graceEndsAt: null, grants: false },
  { name: 'paused never grants', status: 'paused', trialEndsAt: null, periodEnd: '2026-12-20T00:00:00Z', graceEndsAt: null, grants: false },
]
