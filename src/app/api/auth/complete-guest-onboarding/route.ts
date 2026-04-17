import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Flip `user_metadata.onboarding_completed = true` on the authenticated user.
 *
 * Called right after a successful guest→signup promotion. The guest already
 * walked through their 6-step flow and their profile basics (name, gender,
 * country, city, currencies) were carried forward via the existing Zustand
 * merge path. We don't want to drag them through the 27-step expert flow
 * after that — middleware's onboarding redirect checks this metadata key, so
 * setting it skips the expert flow entirely.
 *
 * The guard is simple: the request must carry a valid session whose user we
 * can verify via the server-side client, and we only set the flag if it's
 * currently false (idempotent).
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
        onboarding_source: 'guest_promotion',
        onboarding_completed_at: new Date().toISOString(),
      },
    })
    if (error) {
      console.error('[auth/complete-guest-onboarding] updateUserById failed', error.message)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/complete-guest-onboarding] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
