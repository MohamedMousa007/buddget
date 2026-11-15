import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LIMIT_CATALOG, isFeatureOverrideKey, type LimitKey } from './limits'

const UNENFORCED = new Set(['sparks_per_month', 'seats', 'budget_plans_max', 'sms_accounts_max'])

describe('AI limits stay in step with public.ai_default_limits()', () => {
  const sql = readFileSync('supabase/migrations/0290_s6_limits_and_sms_quota.sql', 'utf8')
  const body = sql.slice(sql.indexOf('function public.ai_default_limits()'), sql.indexOf('update public.plans'))
  const defaults = [...body.matchAll(/'(\w+)',\s*(null|\d+)/g)].map((m) => [m[1]!, m[2] === 'null' ? null : Number(m[2])] as const)

  it('has a catalog entry with the same fallback for every SQL default the portal manages', () => {
    const managed = defaults.filter(([k]) => k !== 'ai_idle_minutes')
    expect(managed.length).toBeGreaterThanOrEqual(19)
    for (const [key, value] of managed) {
      expect(key in LIMIT_CATALOG, key).toBe(true)
      expect(LIMIT_CATALOG[key as LimitKey].fallback, key).toBe(value)
      if (!UNENFORCED.has(key)) expect(LIMIT_CATALOG[key as LimitKey].enforced, key).toBe(true)
    }
  })
})

describe('isFeatureOverrideKey', () => {
  it('accepts catalog names and per-domain AI tool switches only', () => {
    for (const k of ['ai_assistant', 'ai_voice', 'ai_budget', 'ai_tool_debts']) expect(isFeatureOverrideKey(k), k).toBe(true)
    for (const k of ['toString', 'constructor', 'ai_tool_', 'ai_tool_X', 'whatever']) expect(isFeatureOverrideKey(k), k).toBe(false)
  })
})
