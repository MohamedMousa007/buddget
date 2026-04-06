'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Best-effort sync of name to `user_profiles` when the user is signed in.
 * City/country live in the finance JSON payload via `updateProfile` elsewhere.
 */
export async function pushProfileFieldsToSupabase(updates: {
  name?: string
}): Promise<void> {
  if (!updates.name?.trim()) return
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('user_profiles')
      .update({
        display_name: updates.name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
  } catch {
    /* non-fatal */
  }
}
