import { describe, expect, it } from 'vitest'
import { functionBodies, latestFunctionBody, loadMigrations } from './cronMigrations'

const migrations = loadMigrations()
const latest = (fn: string) => {
  const body = latestFunctionBody(migrations, fn)
  if (!body) throw new Error(`no migration defines public.${fn}`)
  return body
}
const firstArray = (body: string) => [...(/ARRAY\[([^\]]*)\]/i.exec(body)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
const squash = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

describe('sync probe parity', () => {
  it('sync_pull_v2 answers from sync_pull, so sync_pull holds the table list the probe must mirror', () => {
    expect(latest('sync_pull_v2')).toMatch(/public\.sync_pull\(p_since\)/i)
  })

  it('sync_changed_since watches exactly the tables sync_pull returns, plus profile and settings', () => {
    const pull = latest('sync_pull')
    const pulled = new Set([...firstArray(pull), ...[...pull.matchAll(/FROM\s+(budget_[a-z_]+)/gi)].map((m) => m[1])])
    const probe = latest('sync_changed_since')
    expect(new Set(firstArray(probe))).toEqual(pulled)
    for (const t of ['profiles', 'user_settings']) {
      expect(pull).toMatch(new RegExp(`FROM\\s+${t}\\b`, 'i'))
      expect(probe).toMatch(new RegExp(`FROM\\s+public\\.${t}\\b`, 'i'))
    }
  })
})

describe('AI credit windows', () => {
  it('ai_credit_windows is the 0298 plain-sum version again (no maintained counter)', () => {
    const original = functionBodies(migrations, 'ai_credit_windows').find((b) => b.file.startsWith('0298_'))
    expect(original, '0298 defines ai_credit_windows').toBeDefined()
    expect(squash(latest('ai_credit_windows'))).toBe(squash(original!.body))
    expect(latest('ai_credit_windows')).not.toMatch(/ai_credit_counters|ai_credit_bump/i)
  })

  // 0337 (BDG-011) changed ai_quota_settle_core on purpose: a call that showed the user nothing is logged, not charged.
  it('ai_quota_settle_core keeps no maintained counter and charges nothing for error or aborted_empty', () => {
    const body = squash(latest('ai_quota_settle_core'))
    expect(body).not.toMatch(/ai_credit_counters|ai_credit_bump/)
    expect(body).toContain("p_status in ('error', 'aborted_empty')")
    expect(body).toContain('r.advisor_free or v_free')
    expect(body).toContain('units = units + v_units')
  })

  it('the credit sums count every non-sms, non-exempt event since the window cut', () => {
    const body = squash(latest('ai_credit_windows'))
    expect(body.match(/sum\(cost_usd_micro\)/g)).toHaveLength(2)
    expect(body.match(/feature <> 'sms' and not credits_exempt and created_at >= (w_cut|s_cut)/g)).toHaveLength(2)
  })
})
