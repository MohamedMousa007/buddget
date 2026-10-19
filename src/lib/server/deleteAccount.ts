import type { ServiceClient } from '@/lib/supabase/service'

/**
 * Permanently deletes a user and every piece of data Buddget holds for them.
 *
 * There are no `auth.users` FKs on the public tables (they only store `user_id`), so cascade-on-auth-delete
 * doesn't clean them up. Each user-scoped table is deleted explicitly, children first, and the auth user last.
 * Shared by the self-service route and the admin portal so both stay identical.
 */
const USER_ID_TABLES = [
  // Budget shape
  'buddgy_memories',
  'budget_subcategories',
  'budget_categories',
  'budget_feedback',
  'budget_plan_activations',
  'buddgy_memories',
  'budget_plans',
  // Transactions
  'expenses',
  'recurring_expenses',
  'subscriptions',
  // Debt
  'debt_payments',
  'recurring_debt_payments',
  'debts',
  // Savings
  'savings_transactions',
  'savings_holdings',
  'recurring_savings_deposits',
  'savings_accounts',
  // Other domains
  'goals',
  'income_events',
  'income_sources',
  'payment_methods',
  'notifications',
  'app_analytics_events',
  'app_analytics_daily',
  // Singletons
  'user_settings',
] as const

export async function deleteUserCompletely(
  admin: ServiceClient,
  uid: string,
): Promise<{ ok: true; partialErrors: string[] } | { ok: false; error: string; details: string[] }> {
  // The owner row is protected by a database trigger, so deleting that auth user would fail only after
  // the data below had already been wiped. Refuse up front.
  const { data: staff } = await admin.from('admin_staff').select('role_key').eq('user_id', uid).maybeSingle()
  if (staff?.role_key === 'owner') return { ok: false, error: 'The owner account cannot be deleted', details: [] }

  const errors: string[] = []

  for (const table of USER_ID_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', uid)
    if (error) errors.push(`${table}: ${error.message}`)
  }

  // profiles.id === user_id (no user_id column).
  {
    const { error } = await admin.from('profiles').delete().eq('id', uid)
    if (error) errors.push(`profiles: ${error.message}`)
  }

  // Finally the auth user itself — revokes all sessions.
  const { error: delUserErr } = await admin.auth.admin.deleteUser(uid)
  if (delUserErr) {
    errors.push(`auth.users: ${delUserErr.message}`)
    return { ok: false, error: 'Failed to delete auth user', details: errors }
  }
  return { ok: true, partialErrors: errors }
}
