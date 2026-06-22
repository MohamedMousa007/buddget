import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import type { Json } from '@/lib/supabase/database.types'

interface CompletionPayload {
  financialGoals?: string[]
  incomeRange?: string
  moneyManagementMethod?: string
  spendingCategories?: string[]
}

/**
 * Terminal handoff from onboarding. Flips
 * `user_metadata.onboarding_completed = true` with `onboarding_source =
 * 'survey_flow'` so middleware lets the user through.
 *
 * Also persists extra onboarding answers to `onboarding_state.answers` so
 * they're available for AI personalisation and future analytics.
 *
 * Idempotent: returns early when the flag is already set.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await resolveRouteUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const admin = createServiceRoleClient()
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        onboarding_completed: true,
        onboarding_source: 'survey_flow',
        onboarding_completed_at: new Date().toISOString(),
      },
    })
    if (error) {
      console.error('[auth/complete-journey] updateUserById failed', error.message)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    const { error: profileErr } = await admin
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id)
    if (profileErr) {
      console.error('[auth/complete-journey] profiles update failed', profileErr.message)
    }

    // Persist extra onboarding answers for AI personalisation.
    let payload: CompletionPayload = {}
    try {
      payload = (await req.json()) as CompletionPayload
    } catch {
      // body is optional — older clients may not send it
    }
    const { financialGoals, incomeRange, moneyManagementMethod, spendingCategories } = payload
    const hasAnswers = financialGoals || incomeRange || moneyManagementMethod || spendingCategories
    if (hasAnswers) {
      const { data: existing } = await admin
        .from('onboarding_state')
        .select('answers')
        .eq('user_id', user.id)
        .single()

      const merged: Record<string, Json> = {
        ...((existing?.answers as Record<string, Json>) ?? {}),
        ...(financialGoals ? { financial_goals: financialGoals as Json } : {}),
        ...(incomeRange ? { income_range: incomeRange } : {}),
        ...(moneyManagementMethod ? { money_management_method: moneyManagementMethod } : {}),
        ...(spendingCategories ? { spending_categories: spendingCategories as Json } : {}),
      }

      const { error: stateErr } = await admin.from('onboarding_state').upsert(
        {
          user_id: user.id,
          answers: merged as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      if (stateErr) {
        console.error('[auth/complete-journey] onboarding_state upsert failed', stateErr.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/complete-journey] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
