import type { ServiceClient } from '@/lib/supabase/service'

export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_MS = 15 * 60 * 1000

export interface CredentialRow {
  user_id: string
  password_hash: string
  setup_completed_at: string | null
  sso_enabled: boolean
  failed_attempts: number
  locked_until: string | null
}

const COLUMNS = 'user_id, password_hash, setup_completed_at, sso_enabled, failed_attempts, locked_until'

export async function loadCredentials(service: ServiceClient, userId: string): Promise<CredentialRow | null> {
  const { data } = await service.from('admin_credentials').select(COLUMNS).eq('user_id', userId).maybeSingle()
  return data as CredentialRow | null
}

export function isLocked(cred: Pick<CredentialRow, 'locked_until'>): boolean {
  return !!cred.locked_until && new Date(cred.locked_until).getTime() > Date.now()
}

export async function recordFailure(service: ServiceClient, cred: CredentialRow): Promise<{ locked: boolean }> {
  const attempts = cred.failed_attempts + 1
  const lock = attempts >= MAX_FAILED_ATTEMPTS
  await service
    .from('admin_credentials')
    .update({ failed_attempts: lock ? 0 : attempts, locked_until: lock ? new Date(Date.now() + LOCKOUT_MS).toISOString() : cred.locked_until })
    .eq('user_id', cred.user_id)
  return { locked: lock }
}

export async function clearFailures(service: ServiceClient, userId: string): Promise<void> {
  await service.from('admin_credentials').update({ failed_attempts: 0, locked_until: null }).eq('user_id', userId)
}

export async function allowAttempt(service: ServiceClient, key: string, windowSeconds: number, max: number): Promise<boolean> {
  const { data, error } = await service.rpc('admin_rate_hit', { p_key: key, p_window_seconds: windowSeconds, p_max_hits: max })
  if (error) {
    console.error('[admin/auth] rate-limit rpc failed', error.message)
    return false
  }
  return data !== false
}
