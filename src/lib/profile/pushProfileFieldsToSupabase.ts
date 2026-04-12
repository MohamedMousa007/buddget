'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Best-effort sync of profile fields to `user_profiles` when the user is signed in.
 * Finance JSON (`user_finance`) remains the source of truth for income; this mirrors
 * name/city/country onto relational columns when present.
 */
export async function pushProfileFieldsToSupabase(updates: {
  name?: string
  city?: string | null
  country?: string | null
}): Promise<void> {
  const patch: Record<string, string | null> = {}
  if (updates.name?.trim()) patch.display_name = updates.name.trim()
  if (updates.city !== undefined) patch.city = updates.city?.trim() || null
  if (updates.country !== undefined) patch.country = updates.country?.trim() || null
  if (Object.keys(patch).length === 0) return
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('user_profiles')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
  } catch {
    /* non-fatal */
  }
}
