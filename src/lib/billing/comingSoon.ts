import { createClient } from '@/lib/supabase/client'

export type ComingSoonFeature = 'partner_sharing' | 'advanced_insights'

/** Records interest in a feature that is not built yet: one row per person and feature, which also tells us what to build first. */
export async function notifyComingSoon(feature: ComingSoonFeature): Promise<boolean> {
  const { error } = await createClient().rpc('coming_soon_notify', { p_feature: feature })
  return !error
}
