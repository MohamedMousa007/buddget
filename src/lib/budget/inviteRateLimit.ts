import type { SupabaseClient } from '@supabase/supabase-js'

const INVITE_DAILY_MAX = 10
const LOOKUP_HOURLY_MAX = 60

/** Counts invites created by this user in the last 24 hours. */
export async function countInvitesLast24h(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('shared_budget_members')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', userId)
    .eq('status', 'pending')
    .gte('invited_at', since)

  if (error) {
    console.error('[invite rate]', error.message)
    return INVITE_DAILY_MAX
  }
  return count ?? 0
}

export function isOverInviteLimit(count: number): boolean {
  return count >= INVITE_DAILY_MAX
}

/** Log a lookup attempt (service role client). */
export async function logEmailLookup(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from('budget_email_lookup_log').insert({ user_id: userId })
}

export async function countLookupsLastHour(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('budget_email_lookup_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)

  if (error) {
    console.error('[lookup rate]', error.message)
    return LOOKUP_HOURLY_MAX
  }
  return count ?? 0
}

export function isOverLookupLimit(count: number): boolean {
  return count >= LOOKUP_HOURLY_MAX
}
