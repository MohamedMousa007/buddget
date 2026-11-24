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

  // 0338 (BDG-011 slice 2): one charge per user message.
  it('ai_quota_settle keeps the per-request rule without a turn and charges a turn once', () => {
    const body = squash(latest('ai_quota_settle'))
    expect(body).toContain('if r.turn_id is null then if r.use_sparks and')
    expect(body).toContain('perform public.ai_turn_close_charged(p_user, r.turn_id, p_reservation)')
    expect(body).toContain('set credits_exempt = true, units = 0')
    expect(squash(latest('ai_quota_settle_core'))).toContain('v_free := v_fail or r.free_rerun')
  })

  // 0344: a free failure that cost money is charged once the user has 5 in the last hour; a failure that cost nothing never is.
  it('ai_quota_settle_core caps costly free failures at 5 an hour and never caps zero-cost ones', () => {
    const core = squash(latest('ai_quota_settle_core'))
    expect(core).toContain('if v_fail and v_cost > 0 and (')
    expect(core).toContain("created_at > now() - interval '1 hour'")
    expect(core).toContain('cost_usd_micro > 0 limit 5')
    expect(core).toContain(') >= 5 then v_fail := false; end if;')
  })

  it('a free re-run and a hop of an open turn skip the credit check; other calls do not', () => {
    const body = squash(latest('ai_quota_reserve_v2'))
    expect(body).toContain('and not v_rerun and not (v_hop and v_turn is not null) and public.billing_enabled()')
    expect(body).toContain("v_rerun := tr.turn_id is not null and tr.state = 'charged' and tr.reruns = 0")
    // The re-run's own tool steps are free too, and it is used up only once it showed something.
    expect(body).toContain('elsif tr.turn_id is not null and tr.rerun_open then v_turn := p_turn; v_rerun := true')
    expect(squash(latest('ai_quota_settle'))).toContain('reruns = reruns + case when tr.rerun_seen then 1 else 0 end')
  })

  it('the credit sums count every non-sms, non-exempt event since the window cut', () => {
    const body = squash(latest('ai_credit_windows'))
    expect(body.match(/sum\(cost_usd_micro\)/g)).toHaveLength(2)
    expect(body.match(/feature <> 'sms' and not credits_exempt and created_at >= (w_cut|s_cut)/g)).toHaveLength(2)
  })
})

// 0342 (1.1b): the daily chat error-rate check. The live proof (rolled back) is in 11-implementation-report.md, step 13.
describe('chat error-rate alert', () => {
  const file = migrations.find((m) => /^0342_/.test(m.file))
  const sql = squash(file?.sql ?? '')

  it('ai_chat_error_check exists and only service_role may run it', () => {
    expect(file, '0342 defines the check').toBeDefined()
    expect(latest('ai_chat_error_check')).toBeTruthy()
    expect(sql).toContain('create or replace function public.ai_chat_error_check() returns integer language plpgsql security definer set search_path = public')
    expect(sql).toContain('revoke all on function public.ai_chat_error_check() from public, anon, authenticated;')
    expect(sql).toContain('grant execute on function public.ai_chat_error_check() to service_role;')
    expect(sql).not.toMatch(/grant execute on function public\.ai_chat_error_check\(\) to [^;]*(anon|authenticated)/)
    expect(sql).toContain('revoke all on public.ai_model_alerts from anon, authenticated;')
  })

  it('reads its thresholds from platform_settings, with defaults when the key or a field is missing', () => {
    const body = squash(latest('ai_chat_error_check'))
    expect(body).toContain("from platform_settings where key = 'ai_chat_error_alert'")
    expect(body).toContain("coalesce((cfg ->> 'maxerrorshare')::numeric, 0.25)")
    expect(body).toContain("coalesce((cfg ->> 'mincalls')::integer, 10)")
    expect(body).toContain("coalesce((cfg ->> 'allfailedmincalls')::integer, 3)")
    expect(body).toContain('(p.calls >= min_calls and (p.errors + p.empties)::numeric / p.calls > max_share) or (p.calls >= all_min and p.errors + p.empties = p.calls)')
    expect(sql).toContain("on conflict (key) do nothing")
  })

  it('scans only chat calls of the last 24 hours, grouped by model, on the partial index', () => {
    const body = squash(latest('ai_chat_error_check'))
    expect(body).toContain("e.feature in ('chat', 'chat_hop') and e.created_at >= now() - interval '24 hours' and e.model is not null group by e.model")
    expect(body).toContain("count(*) filter (where e.status = 'error')")
    expect(body).toContain("count(*) filter (where e.status = 'aborted_empty')")
    expect(sql).toContain("on public.ai_usage_events (created_at) include (model, status) where feature in ('chat', 'chat_hop')")
  })

  it('records at most one alert per model per day, so a second run adds nothing', () => {
    const body = squash(latest('ai_chat_error_check'))
    expect(sql).toContain('unique (model, alert_date)')
    expect(sql).toContain('model text not null')
    expect(body).toContain('on conflict (model, alert_date) do nothing')
    expect(body).toContain("(now() at time zone 'utc')::date")
  })
})
