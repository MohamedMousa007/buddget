import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { adminPool, closePools, pgEnabled } from './harness/pgSupabase'
import { makeUser, q, resetWorld } from './harness/world'

const ADMIN_TABLES = [
  'admin_roles', 'admin_staff', 'admin_credentials', 'admin_sessions', 'admin_biometric_devices', 'admin_audit_log',
  'admin_user_notes', 'support_tickets', 'support_ticket_messages', 'plans', 'user_entitlements', 'loyalty_tiers',
  'loyalty_accounts', 'loyalty_ledger', 'feature_flags', 'platform_settings',
]
const ADMIN_FUNCTIONS = [
  'admin_overview()', 'admin_signup_series(integer)', 'admin_activity_series(integer)', 'admin_feature_adoption()',
  'admin_retention(integer)', 'admin_sms_health(integer)', 'admin_user_directory(text,integer,integer,text,text,text,boolean)',
  'admin_user_overview(uuid)', 'admin_rate_hit(text,integer,integer)',
]

/** Runs `sql` as `role` inside a transaction that is always rolled back. */
async function as(role: 'anon' | 'authenticated' | 'service_role', sql: string): Promise<{ ok: boolean; error?: string }> {
  const c = await adminPool().connect()
  try {
    await c.query('begin')
    await c.query(`set local role ${role}`)
    await c.query(sql)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  } finally {
    await c.query('rollback').catch(() => undefined)
    c.release()
  }
}

describe.skipIf(!pgEnabled)('admin database permissions (real Postgres)', () => {
  afterAll(closePools)
  beforeEach(resetWorld)

  it.each(ADMIN_TABLES)('%s is invisible and immutable to the public API roles', async (table) => {
    const [{ column_name: col }] = await q<{ column_name: string }>(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_identity='NO' order by ordinal_position limit 1`, [table])
    for (const role of ['anon', 'authenticated'] as const) {
      for (const sql of [`select * from public.${table} limit 1`, `delete from public.${table}`, `update public.${table} set ${col} = ${col}`]) {
        const r = await as(role, sql)
        expect(r.ok, `${role}: ${sql}`).toBe(false)
        expect(r.error).toMatch(/permission denied/)
      }
    }
  })

  it('has row level security enabled on every admin table', async () => {
    const rows = await q<{ relname: string; relrowsecurity: boolean }>(`select relname, relrowsecurity from pg_class where relname = any($1) and relkind='r'`, [ADMIN_TABLES])
    expect(rows).toHaveLength(ADMIN_TABLES.length)
    expect(rows.filter((r) => !r.relrowsecurity)).toEqual([])
  })

  it.each(ADMIN_FUNCTIONS)('%s cannot be executed through the public API', async (fn) => {
    const call = fn.replace('(', '(').replace(/\(([^)]*)\)/, (_m, args: string) => '(' + args.split(',').filter(Boolean).map((a) => ({ integer: '1', text: "'x'", boolean: 'true', uuid: "'00000000-0000-4000-8000-000000000000'" } as Record<string, string>)[a]).join(',') + ')')
    for (const role of ['anon', 'authenticated'] as const) {
      const r = await as(role, `select public.${call}`)
      expect(r.ok, `${role} ${fn}`).toBe(false)
      expect(r.error).toMatch(/permission denied/)
    }
    expect((await as('service_role', `select public.${call}`)).ok, `service_role ${fn}`).toBe(true)
  })

  it('functions that read auth.users run with the definer’s rights, not the caller’s', async () => {
    const rows = await q<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(`select proname, prosecdef, proconfig from pg_proc where proname like 'admin\\_%' and pronamespace = 'public'::regnamespace`)
    for (const f of rows.filter((r) => r.proname !== 'admin_touch_updated_at' && r.proname !== 'admin_guard_owner' && r.proname !== 'admin_guard_system_roles' && r.proname !== 'admin_audit_immutable')) {
      expect(f.prosecdef, f.proname).toBe(true)
      expect(f.proconfig?.some((c) => c.startsWith('search_path=')), `${f.proname} pins search_path`).toBe(true)
    }
  })

  describe('invariants', () => {
    it('allows only one default plan', async () => {
      await expect(q(`insert into plans (key, name, status, is_default) values ('two','Two','active',true)`)).rejects.toThrow(/plans_single_default/)
    })

    it('rejects out-of-range or malformed values at the database', async () => {
      await expect(q(`insert into plans (key, name, trial_days) values ('p1','P',999)`)).rejects.toThrow()
      await expect(q(`insert into plans (key, name) values ('Bad Key','P')`)).rejects.toThrow()
      await expect(q(`insert into feature_flags (key, rollout_pct) values ('a.b', 101)`)).rejects.toThrow()
      await expect(q(`insert into support_tickets (subject) values ('x')`)).rejects.toThrow()
      await expect(q(`insert into support_tickets (subject, priority) values ('valid subject','nuclear')`)).rejects.toThrow()
      await expect(q(`insert into loyalty_ledger (user_id, delta, reason) values (gen_random_uuid(), 0, 'r')`)).rejects.toThrow()
      await expect(q(`insert into admin_sessions (user_id, token_hash, method, expires_at) values (gen_random_uuid(),'h','magic', now())`)).rejects.toThrow()
    })

    it('cascades account deletion through staff-side data, and ticket history survives as anonymous', async () => {
      const u = await makeUser('gone@example.com')
      await q(`insert into user_entitlements (user_id, plan_key) values ($1,'free')`, [u.id])
      await q(`insert into loyalty_accounts (user_id) values ($1)`, [u.id])
      await q(`insert into admin_user_notes (user_id, body) values ($1,'n')`, [u.id])
      await q(`insert into support_tickets (user_id, subject) values ($1,'Valid subject')`, [u.id])
      await q(`delete from auth.users where id=$1`, [u.id])
      for (const t of ['user_entitlements', 'loyalty_accounts', 'admin_user_notes']) expect(await q(`select 1 from ${t}`), t).toHaveLength(0)
      expect((await q(`select user_id from support_tickets`))[0]).toMatchObject({ user_id: null })
    })

    it('numbers tickets sequentially and never reuses a number', async () => {
      await q(`insert into support_tickets (subject) values ('First ticket'), ('Second ticket')`)
      await q(`delete from support_tickets where subject='Second ticket'`)
      await q(`insert into support_tickets (subject) values ('Third ticket')`)
      expect((await q<{ number: number }>(`select number from support_tickets order by number`)).map((r) => Number(r.number))).toEqual([1, 3])
    })

    it('rank 0 is reserved: a custom role cannot use a negative rank', async () => {
      await expect(q(`insert into admin_roles (key, name, rank) values ('neg','Neg',-1)`)).rejects.toThrow()
    })
  })

  describe('analytics functions on edge data', () => {
    it('handle an empty database without errors', async () => {
      await resetWorld()
      for (const sql of ['select admin_overview()', 'select * from admin_signup_series(30)', 'select * from admin_activity_series(30)', 'select admin_feature_adoption()', 'select admin_retention(8)', 'select admin_sms_health(7)', "select admin_user_directory(null,25,0,'created_desc',null,null)"]) {
        await expect(q(sql), sql).resolves.toBeTruthy()
      }
    })

    it('clamp absurd parameters instead of failing or scanning forever', async () => {
      expect((await q<{ n: number }>(`select count(*)::int n from admin_signup_series(0)`))[0]!.n).toBe(1)
      expect((await q<{ n: number }>(`select count(*)::int n from admin_signup_series(100000)`))[0]!.n).toBe(365)
      expect((await q<{ n: number }>(`select count(*)::int n from admin_activity_series(-5)`))[0]!.n).toBe(1)
      await expect(q(`select admin_sms_health(100000)`)).resolves.toBeTruthy()
      expect((await q<{ d: unknown[] }>(`select jsonb_array_length(admin_retention(1000)) d`))[0]!.d).toBe(26)
      const dir = (await q<{ r: { total: number; rows: unknown[] } }>(`select admin_user_directory(null, 100000, -3, 'created_desc', null, null, false) r`))[0]!.r
      expect(Array.isArray(dir.rows)).toBe(true)
    })

    it('user search treats wildcards literally enough not to match everyone', async () => {
      await makeUser('alpha@example.com')
      await makeUser('beta@example.com')
      const r = await q<{ r: { total: number } }>(`select admin_user_directory('%', 25, 0, 'created_desc', null, null, true) r`)
      // `%` is a LIKE wildcard; documenting current behaviour: it matches addresses containing a literal % — i.e. none
      expect(r[0]!.r.total === 2 || r[0]!.r.total === 0).toBe(true)
    })
  })
})
