import { NextResponse } from 'next/server'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Permanently delete the authenticated user's account and every piece of data
 * Buddget holds for them.
 *
 * There are no `auth.users` FKs on the public tables (they only store `user_id`),
 * so cascade-on-auth-delete doesn't clean them up. We delete each user-scoped
 * table explicitly with the service role, then delete the auth user last.
 *
 * Supports both cookie-based auth (web) and Bearer JWT (native Capacitor) via
 * resolveApiUserId — never pass a user id in the body.
 */
const USER_ID_TABLES = [
  // Budget shape
  'budget_subcategories',
  'budget_categories',
  'budget_feedback',
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
  'income_sources',
  'payment_methods',
  'notifications',
  'app_analytics_events',
  // Singletons
  'user_settings',
] as const

export async function POST(request: Request) {
  try {
    const uid = await resolveApiUserId(request)
    if (!uid) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createServiceRoleClient()
    const errors: string[] = []

    // Delete user-scoped rows in dependency-safe order (children before parents).
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
      return NextResponse.json(
        { error: 'Failed to delete auth user', details: errors },
        { status: 500 }
      )
    }

    if (errors.length > 0) {
      console.error('[account/delete] partial failures:', errors)
    }

    return NextResponse.json({ ok: true, partialErrors: errors.length ? errors : undefined })
  } catch (e) {
    console.error('[account/delete] unexpected failure', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
