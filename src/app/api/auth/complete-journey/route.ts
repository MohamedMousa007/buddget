import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Terminal handoff from onboarding. Flips
 * `user_metadata.onboarding_completed = true` with `onboarding_source =
 * 'survey_flow'` so middleware lets the user through.
 *
 * Idempotent: returns early when the flag is already set so replays
 * (from the terminal plan screen retry, or a mid-navigation bounce) are
 * safe.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (user.user_metadata?.onboarding_completed === true) {
      return NextResponse.json({ ok: true, alreadyCompleted: true })
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

    const { error: profileErr } = await admin.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
    if (profileErr) {
      console.error('[auth/complete-journey] profiles update failed', profileErr.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/complete-journey] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
