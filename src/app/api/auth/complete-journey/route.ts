import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Terminal handoff from the Journey (v3). Flips
 * `user_metadata.onboarding_completed = true` with `onboarding_source =
 * 'journey_v3'` so middleware lets the user through and we can tell
 * journey-completers apart from legacy core-gate users in analytics.
 *
 * Idempotent: returns early when the flag is already set so replays
 * (from SP5's BuildingPlanScreen retry, or a mid-navigation bounce) are
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
        onboarding_source: 'journey_v3',
        onboarding_completed_at: new Date().toISOString(),
      },
    })
    if (error) {
      console.error('[auth/complete-journey] updateUserById failed', error.message)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/complete-journey] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
