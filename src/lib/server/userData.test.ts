import { describe, expect, it } from 'vitest'
import { ACCOUNT_TABLES, SIGN_IN_TABLES, USER_DATA_TABLES, exportUserData } from './userData'
import type { ServiceClient } from '@/lib/supabase/service'

/**
 * Every public table that carries a user key, from the live schema (migration 0203 header has the SELECT that
 * regenerates it). A table added to the database must be added here AND to a deletion list, or this test fails.
 */
const LIVE_USER_KEYED = [
  'account_adjustments', 'account_balance_reports', 'admin_access_grants:target_user_id', 'admin_audit_log:actor_id',
  'admin_biometric_devices', 'admin_credentials', 'admin_financial_exclusions', 'admin_sessions', 'admin_staff', 'admin_user_notes',
  'ai_chats', 'ai_reservations', 'ai_usage_daily', 'ai_usage_events', 'app_analytics_daily', 'app_analytics_events',
  'biometric_devices', 'buddgy_memories', 'budget_categories', 'budget_feedback', 'budget_plan_activations', 'budget_plans',
  'budget_subcategories', 'client_crashes', 'debt_payments', 'debts', 'email_log', 'expenses', 'feedback_votes',
  'goal_allocation_runs', 'goals', 'income_events', 'income_sources', 'loyalty_accounts', 'loyalty_ledger',
  'merchant_category_overrides', 'merchant_category_votes', 'net_worth_snapshots', 'notifications', 'payment_methods',
  'push_tokens', 'receipts', 'recurring_debt_payments', 'recurring_expenses', 'recurring_savings_deposits', 'savings_accounts',
  'savings_holdings', 'savings_month_summary', 'savings_transactions', 'sms_ingest_tokens', 'sms_parse_log',
  'sms_sender_currency', 'sms_stats_outbox', 'sms_template_hard_signals', 'sms_template_signals', 'sms_template_users', 'sms_tracking_templates_ai',
  'subscriptions', 'support_tickets', 'trusted_devices', 'user_devices', 'user_entitlements', 'user_milestones', 'user_settings',
] as const

/** Deliberately not erased by the code path, with the reason. */
const KEPT: Record<string, string> = {
  admin_staff: 'staff identity: removed by the staff flow, the owner row is protected',
  admin_credentials: 'staff sign-in, owned by the staff flow',
  admin_sessions: 'staff sign-in, owned by the staff flow',
  admin_biometric_devices: 'staff sign-in, owned by the staff flow',
  admin_audit_log: 'audit trail; actor_id is a staff id, not a data subject',
  email_log: 'delivery audit; address is scrubbed (scrubPersonalText) and user_id set to null by FK',
  support_tickets: 'staff history; requester email and context scrubbed (scrubPersonalText), user_id set to null by FK',
  client_crashes: 'crash telemetry; user_id set to null by FK, expires after 120 days',
  sms_tracking_templates_ai: 'shared learned templates; FK cascades with the creating user',
}

describe('account erasure coverage', () => {
  const covered = new Set<string>([
    ...USER_DATA_TABLES,
    ...ACCOUNT_TABLES.map((t) => t.table),
    ...SIGN_IN_TABLES.map((t) => t.table),
    ...Object.keys(KEPT),
  ])

  it('every user-keyed table is deleted, scrubbed or explicitly kept', () => {
    const missing = LIVE_USER_KEYED.map((t) => t.split(':')[0]).filter((t) => !covered.has(t))
    expect(missing).toEqual([])
  })

  it('no deletion list names a table that does not exist', () => {
    const live = new Set<string>(LIVE_USER_KEYED.map((t) => t.split(':')[0]).concat(['profiles']))
    const unknown = [...USER_DATA_TABLES, ...ACCOUNT_TABLES.map((t) => t.table), ...SIGN_IN_TABLES.map((t) => t.table)].filter((t) => !live.has(t))
    expect(unknown).toEqual([])
  })

  it('the keyed column in the lists matches the live schema', () => {
    const column = Object.fromEntries(LIVE_USER_KEYED.map((t) => { const [name, col] = t.split(':'); return [name, col ?? 'user_id'] }))
    for (const { table, column: c = 'user_id' } of [...ACCOUNT_TABLES, ...SIGN_IN_TABLES]) expect(column[table]).toBe(c)
  })
})

describe('exportUserData', () => {
  it('covers every deletion list, leaves credentials out and follows tickets to their messages', async () => {
    const asked: string[] = []
    const rows: Record<string, unknown[]> = {
      sms_ingest_tokens: [{ id: 't1', token: 'secret', is_active: true }],
      biometric_devices: [{ device_id: 'd', secret_hash: 'h' }],
      support_tickets: [{ id: 'tk1' }],
      support_ticket_messages: [{ id: 'm1', ticket_id: 'tk1' }],
    }
    const admin = {
      from: (table: string) => {
        asked.push(table)
        const q = { select: () => q, eq: () => q, in: () => q, limit: async () => ({ data: rows[table] ?? [], error: null }) }
        return q
      },
    } as unknown as ServiceClient
    const { tables, failed } = await exportUserData(admin, 'u1', 100)
    expect(failed).toEqual([])
    for (const t of [...USER_DATA_TABLES, ...ACCOUNT_TABLES.map((a) => a.table), ...SIGN_IN_TABLES.map((a) => a.table), 'email_log', 'support_tickets']) {
      expect(asked).toContain(t)
    }
    expect(tables.sms_ingest_tokens).toEqual([{ id: 't1', is_active: true }])
    expect(tables.biometric_devices).toEqual([{ device_id: 'd' }])
    expect(tables.support_ticket_messages).toHaveLength(1)
  })
})

describe('exportUserData paging (SIT10)', () => {
  /** A fake PostgREST that answers at most 1000 rows per request, like the live project. */
  const service = (all: Record<string, { id: number }[]>, opts: { noId?: string[] } = {}) => {
    const ranges: string[] = []
    const admin = {
      from: (table: string) => {
        const rows = all[table] ?? []
        let ordered = false
        const q = {
          select: () => q, eq: () => q, in: () => q,
          order: () => { ordered = true; return q },
          limit: async () => ({ data: rows.slice(0, 1000), count: rows.length, error: null }),
          range: async (from: number, to: number) => {
            ranges.push(`${table}:${from}-${to}`)
            if (opts.noId?.includes(table) || !ordered) return { data: null, error: { message: 'column id does not exist' } }
            return { data: rows.slice(from, Math.min(to, from + 999) + 1), error: null }
          },
        }
        return q
      },
    } as unknown as ServiceClient
    return { admin, ranges }
  }
  const make = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }))

  it('pages a table longer than 1000 rows so the export is complete', async () => {
    const { admin, ranges } = service({ expenses: make(2500), debts: make(3) })
    const { tables, failed } = await exportUserData(admin, 'u1', 20000)
    expect(failed).toEqual([])
    expect(tables.expenses).toHaveLength(2500)
    expect(new Set((tables.expenses as { id: number }[]).map((r) => r.id)).size).toBe(2500)
    expect(ranges).toEqual(['expenses:0-999', 'expenses:1000-1999', 'expenses:2000-2499'])
    expect(tables.debts).toHaveLength(3)
  })

  it('stops at the per-table cap and reports the table as incomplete', async () => {
    const { admin } = service({ expenses: make(2500) })
    const { tables, failed } = await exportUserData(admin, 'u1', 1500)
    expect(tables.expenses).toHaveLength(1500)
    expect(failed).toEqual(['expenses'])
  })

  it('reports a long table it cannot page instead of exporting it silently short', async () => {
    const { admin } = service({ expenses: make(2500) }, { noId: ['expenses'] })
    const { tables, failed } = await exportUserData(admin, 'u1', 20000)
    expect(failed).toEqual(['expenses'])
    expect(tables.expenses).toHaveLength(1000)
  })
})

describe('ADS-7 website leads in the data-subject export', () => {
  it('exports the leads sent from the account address, matched lower-case, and only when an address is known', async () => {
    const eqs: string[] = []
    const admin = {
      from: (table: string) => {
        const q = { select: () => q, eq: (c: string, v: string) => { if (table === 'site_leads') eqs.push(`${c}=${v}`); return q }, in: () => q, limit: async () => ({ data: table === 'site_leads' ? [{ id: 'l1', email: 'a@x.com' }] : [], error: null }) }
        return q
      },
    } as unknown as ServiceClient
    const withEmail = await exportUserData(admin, 'u1', 100, 'A@X.com')
    expect(withEmail.tables.site_leads).toEqual([{ id: 'l1', email: 'a@x.com' }])
    expect(eqs).toEqual(['email=a@x.com'])
    expect((await exportUserData(admin, 'u1', 100)).tables.site_leads).toBeUndefined()
  })
})
