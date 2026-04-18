import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Flip `user_metadata.onboarding_completed = true` after the 4-step core gate.
 *
 * Mirrors `/api/auth/complete-guest-onboarding` but tags the source so we can
 * tell progressive-onboarding users apart from guest-promoted users in admin
 * analytics. Middleware's onboarding redirect checks the metadata key, so
 * flipping it is what releases the user to the real app.
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
        onboarding_source: 'core_gate',
        onboarding_completed_at: new Date().toISOString(),
      },
    })
    if (error) {
      console.error('[auth/complete-core-onboarding] updateUserById failed', error.message)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/complete-core-onboarding] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
