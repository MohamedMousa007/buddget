import type { ServiceClient } from '@/lib/supabase/service'

/**
 * Every table that holds a user's financial life, children before parents. Account deletion, the self-service
 * "start fresh" and the admin reset all wipe exactly this set, so they cannot drift apart.
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
  'notifications',
  'app_analytics_events',
  'app_analytics_daily',
  'user_milestones',
  'user_settings',
] as const

/** Deletes the user's data rows; returns what failed (empty when everything went). */
export async function wipeUserData(admin: ServiceClient, uid: string): Promise<string[]> {
  const errors: string[] = []
  for (const table of USER_DATA_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', uid)
    if (error) errors.push(`${table}: ${error.message}`)
  }
  return errors
}

/**
 * Stamps the reset so every other device of the account drops its local copy instead of pushing it back up.
 * `clearProfile` also blanks what the profile learned from the data (household, rent, budget answers, active plan).
 */
export async function stampDataReset(admin: ServiceClient, uid: string, opts: { clearProfile: boolean }): Promise<string[]> {
  const cleared = opts.clearProfile
    ? {
        active_budget_plan_id: null, active_shared_budget_id: null, default_carry_pocket_id: null, default_shared_budget_plan_id: null,
        avatar_emoji: null, avatar_image_path: null, city: null, country: null, gender: null, phone: null,
        household: null, lifestyle_tier: null, food_frequency: null, transport_mode: null, monthly_rent: null, rent_includes_utilities: false,
        emergency_fund_config: {}, zakat_config: {}, financial_profile: null, financial_goals_notes: '', secondary_currency: null,
      }
    : {}
  const { error } = await admin.from('profiles').update({ ...cleared, data_reset_at: new Date().toISOString() }).eq('id', uid)
  return error ? [`profiles: ${error.message}`] : []
}
