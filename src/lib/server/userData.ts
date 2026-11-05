import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceClient } from '@/lib/supabase/service'

/**
 * Every table that holds a user's financial life, children before parents. Account deletion, the admin reset
 * and the data export all use exactly this set, so they cannot drift apart.
 */
export const USER_DATA_TABLES = [
  'buddgy_memories',
  'budget_subcategories',
  'budget_categories',
  'budget_feedback',
  'budget_plan_activations',
  'budget_plans',
  'expenses',
  'receipts',
  'recurring_expenses',
  'subscriptions',
  'debt_payments',
  'recurring_debt_payments',
  'debts',
  'savings_transactions',
  'savings_holdings',
  'recurring_savings_deposits',
  'savings_accounts',
  'goals',
  'income_events',
  'income_sources',
  // Accounts: children of payment_methods, so they go first.
  'account_adjustments',
  'account_balance_reports',
  'payment_methods',
  'net_worth_snapshots',
  'savings_month_summary',
  'goal_allocation_runs',
  // What Buddgy and the SMS pipeline kept about this life; a fresh start must not offer old accounts back.
  'ai_chats',
  'sms_parse_log',
  // Per-user SMS learning: which templates this user fed, their corrections, queued stats, and sender->currency answers.
  'sms_template_users',
  'sms_template_signals',
  'sms_template_hard_signals',
  'sms_stats_outbox',
  'sms_sender_currency',
  'notifications',
  'app_analytics_events',
  'app_analytics_daily',
  'user_milestones',
  'client_crashes',
  'user_settings',
] as const

export interface OwnedTable {
  table: string
  /** The column that holds the user id; `user_id` unless stated. */
  column?: string
}

/**
 * What the app and the platform keep about an account beyond the financial data above. It leaves with the
 * account (self-service delete, admin delete) but is NOT touched by a data reset, which keeps the sign-in, the
 * devices and the usage history. Rows here normally cascade from `auth.users`; the explicit pass catches any
 * table whose foreign key was never added, and `userData.test.ts` fails when a new user-keyed table is missing.
 */
export const ACCOUNT_TABLES: readonly OwnedTable[] = [
  { table: 'user_devices' },
  { table: 'push_tokens' },
  { table: 'sms_ingest_tokens' },
  { table: 'user_entitlements' },
  { table: 'loyalty_ledger' },
  { table: 'loyalty_accounts' },
  { table: 'ai_usage_events' },
  { table: 'ai_usage_daily' },
  { table: 'ai_reservations' },
  { table: 'feedback_votes' },
  { table: 'admin_user_notes' },
  { table: 'admin_financial_exclusions' },
  { table: 'admin_access_grants', column: 'target_user_id' },
  { table: 'merchant_category_overrides' },
  { table: 'merchant_category_votes' },
]

/** Sign-in credentials of the app account. A staff member who empties their app account keeps these (the sign-in stays). */
export const SIGN_IN_TABLES: readonly OwnedTable[] = [{ table: 'trusted_devices' }, { table: 'biometric_devices' }]

/** Columns that are credentials, never exported. */
const REDACTED_COLUMNS: Record<string, readonly string[]> = {
  sms_ingest_tokens: ['token'],
  biometric_devices: ['secret_hash'],
}

const loose = (admin: ServiceClient) => admin as unknown as SupabaseClient

async function deleteOwned(admin: ServiceClient, tables: readonly OwnedTable[], uid: string): Promise<string[]> {
  const errors: string[] = []
  for (const { table, column = 'user_id' } of tables) {
    const { error } = await loose(admin).from(table).delete().eq(column, uid)
    if (error) errors.push(`${table}: ${error.message}`)
  }
  return errors
}

/** Removes the account-level rows (devices, tokens, usage, entitlements, staff notes about the person). */
export function wipeAccountData(admin: ServiceClient, uid: string, opts: { keepSignIn: boolean }): Promise<string[]> {
  return deleteOwned(admin, opts.keepSignIn ? ACCOUNT_TABLES : [...ACCOUNT_TABLES, ...SIGN_IN_TABLES], uid)
}

/**
 * Blanks the personal text that has to outlive the account row: the delivery log keeps its audit trail but loses the
 * address, and support tickets keep their thread (staff history) without the requester's email or device context.
 */
/** email_log.to_email is NOT NULL (0136), so an erased address becomes a placeholder, not null; works before and after 0203. */
const ERASED_ADDRESS = '[erased]'

export async function scrubPersonalText(admin: ServiceClient, uid: string, email: string | null): Promise<string[]> {
  const errors: string[] = []
  const run = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    if (error) errors.push(`${label}: ${error.message}`)
  }
  const db = loose(admin)
  await run('email_log', db.from('email_log').update({ to_email: ERASED_ADDRESS }).eq('user_id', uid))
  await run('support_tickets', db.from('support_tickets').update({ requester_email: null, context: {} }).eq('user_id', uid))
  await eraseSupportText(db, uid, null, run)
  if (email) {
    await eraseSupportText(db, null, email, run)
    await run('email_log(email)', db.from('email_log').update({ to_email: ERASED_ADDRESS }).eq('to_email', email))
    await run('support_tickets(email)', db.from('support_tickets').update({ requester_email: null, context: {} }).eq('requester_email', email))
  }
  return errors
}

/** Ticket kinds worth keeping as product history (bug reports, feature requests, praise); everything else is private help. */
const PRODUCT_FEEDBACK_KINDS = ['bug', 'feature', 'praise']
const ERASED_TEXT = '[deleted]'

/**
 * Blanks the subject and message text of a leaving user's private tickets (support, billing, account, other). Product
 * feedback tickets stay as history for fixing bugs and planning features; their requester email and context are
 * already erased above.
 */
async function eraseSupportText(
  db: SupabaseClient,
  uid: string | null,
  email: string | null,
  run: (label: string, p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>,
): Promise<void> {
  const base = db.from('support_tickets').select('id, kind')
  const { data, error } = await (uid ? base.eq('user_id', uid) : base.eq('requester_email', email ?? ''))
  if (error) return void (await run('support_tickets(read)', Promise.resolve({ error })))
  const ids = ((data ?? []) as { id: string; kind: string }[]).filter((t) => !PRODUCT_FEEDBACK_KINDS.includes(t.kind)).map((t) => t.id)
  if (ids.length === 0) return
  await run('support_ticket_messages', db.from('support_ticket_messages').update({ body: ERASED_TEXT }).in('ticket_id', ids))
  await run('support_tickets(text)', db.from('support_tickets').update({ subject: ERASED_TEXT }).in('id', ids))
}

/** Every row held about one person, for a data-subject access request. Credentials are left out. */
export async function exportUserData(admin: ServiceClient, uid: string, rowsPerTable: number): Promise<{ tables: Record<string, unknown[]>; failed: string[] }> {
  const tables: Record<string, unknown[]> = {}
  const failed: string[] = []
  const db = loose(admin)
  const owned: OwnedTable[] = [...USER_DATA_TABLES.map((table) => ({ table })), ...ACCOUNT_TABLES, ...SIGN_IN_TABLES, { table: 'email_log' }, { table: 'support_tickets' }]
  for (const { table, column = 'user_id' } of owned) {
    // PostgREST answers at most its max-rows (1000 by default) whatever the limit says: a longer table is reported
    // as incomplete rather than exported short without a word.
    const { data, error, count } = await db.from(table).select('*', { count: 'exact' }).eq(column, uid).limit(rowsPerTable)
    if (error || (count ?? 0) > (data?.length ?? 0)) failed.push(table)
    if (!error && data.length) {
      const hidden = REDACTED_COLUMNS[table] ?? []
      tables[table] = hidden.length ? data.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !hidden.includes(k)))) : data
    }
  }
  const ticketIds = ((tables.support_tickets ?? []) as { id: string }[]).map((t) => t.id)
  if (ticketIds.length) {
    const { data, error, count } = await db.from('support_ticket_messages').select('*', { count: 'exact' }).in('ticket_id', ticketIds).limit(rowsPerTable)
    if (error || (count ?? 0) > (data?.length ?? 0)) failed.push('support_ticket_messages')
    if (!error && data.length) tables.support_ticket_messages = data
  }
  return { tables, failed }
}

/** Deletes the user's data rows; returns what failed (empty when everything went). */
export async function wipeUserData(admin: ServiceClient, uid: string): Promise<string[]> {
  const errors: string[] = []
  for (const table of USER_DATA_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', uid)
    if (error) errors.push(`${table}: ${error.message}`)
  }
  return errors
}

/** Removes the profile photo from storage when it is a bucket path (inline/remote URLs hold nothing to delete). Run before the profile is blanked. */
export async function removeAvatarObject(admin: ServiceClient, uid: string): Promise<string[]> {
  try {
    const { data } = await admin.from('profiles').select('avatar_image_path').eq('id', uid).maybeSingle()
    const path = data?.avatar_image_path
    if (!path || /^(https?:|data:)/.test(path)) return []
    const { error } = await admin.storage.from('avatars').remove([path])
    return error ? [`avatar: ${error.message}`] : []
  } catch (e) {
    return [`avatar: ${e instanceof Error ? e.message : 'removal failed'}`]
  }
}

/**
 * Stamps the reset so every other device of the account drops its local copy instead of pushing it back up.
 * Also blanks what the profile learned from the data (household, rent, budget answers, active plan).
 */
export async function stampDataReset(admin: ServiceClient, uid: string, opts: { blankIdentity?: boolean } = {}): Promise<string[]> {
    const cleared = {
      active_budget_plan_id: null, active_shared_budget_id: null, default_carry_pocket_id: null, default_shared_budget_plan_id: null,
      avatar_emoji: null, avatar_image_path: null, city: null, country: null, gender: null, phone: null,
      household: null, lifestyle_tier: null, food_frequency: null, transport_mode: null, monthly_rent: null, rent_includes_utilities: false,
        emergency_fund_config: {}, zakat_config: {}, financial_profile: null, financial_goals_notes: '', secondary_currency: null,
  }
  // The staff path keeps the profile row for sign-in; the personal text on it goes like the rest.
  const identity = opts.blankIdentity ? { name: '', display_name: null, email: null } : {}
  const { error } = await admin.from('profiles').update({ ...cleared, ...identity, data_reset_at: new Date().toISOString() }).eq('id', uid)
  return error ? [`profiles: ${error.message}`] : []
}
