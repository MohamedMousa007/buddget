import { NextResponse } from 'next/server'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Wipe all financial data for the authenticated user without deleting their
 * account. Supports cookie auth (web) and Bearer JWT (native Capacitor).
 *
 * Tables are deleted in dependency-safe order (children before parents).
 */
const FINANCIAL_TABLES = [
  'budget_subcategories',
  'budget_categories',
  'budget_feedback',
  'budget_plans',
  'expenses',
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
  'income_sources',
  'payment_methods',
  'notifications',
  'app_analytics_events',
  'onboarding_feedback',
  'onboarding_state',
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

    for (const table of FINANCIAL_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', uid)
      if (error) errors.push(`${table}: ${error.message}`)
    }

    if (errors.length > 0) {
      console.error('[account/reset-data] partial failures:', errors)
    }

    return NextResponse.json({ ok: true, partialErrors: errors.length ? errors : undefined })
  } catch (e) {
    console.error('[account/reset-data] unexpected failure', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
