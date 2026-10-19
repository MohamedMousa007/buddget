import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import type { ServiceClient } from '@/lib/supabase/service'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'
import { decryptSecret, hashRecoveryCode, normalizeRecoveryCode, safeEqual } from './crypto'
import { verifyTotp } from './totp'

export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_MS = 15 * 60 * 1000
const FRESH_SIGN_IN_MS = 15 * 60 * 1000

export interface CredentialRow {
  user_id: string
  password_hash: string
  totp_secret_enc: string | null
  totp_confirmed_at: string | null
  totp_last_step: number | null
  recovery_hashes: string[]
  failed_attempts: number
  locked_until: string | null
}

const COLUMNS = 'user_id, password_hash, totp_secret_enc, totp_confirmed_at, totp_last_step, recovery_hashes, failed_attempts, locked_until'

export async function loadCredentials(service: ServiceClient, userId: string): Promise<CredentialRow | null> {
  const { data } = await service.from('admin_credentials').select(COLUMNS).eq('user_id', userId).maybeSingle()
  return data as CredentialRow | null
}

export function isLocked(cred: Pick<CredentialRow, 'locked_until'>): boolean {
  return !!cred.locked_until && new Date(cred.locked_until).getTime() > Date.now()
}

export type SecondFactorResult = { ok: true; via: 'totp' | 'recovery' } | { ok: false }

/**
 * Checks a 6-digit authenticator code (once per time step) or a recovery code (once ever).
 * Consumption is a conditional update, so two concurrent requests cannot both spend the same code.
 */
export async function consumeSecondFactor(service: ServiceClient, cred: CredentialRow, input: string): Promise<SecondFactorResult> {
  const code = input.trim()
  if (!code) return { ok: false }

  if (/^\d{3}\s?\d{3}$/.test(code) && cred.totp_secret_enc) {
    const step = verifyTotp(decryptSecret(cred.totp_secret_enc), code, Date.now(), cred.totp_last_step)
    if (step === null) return { ok: false }
    const { data } = await service
      .from('admin_credentials')
      .update({ totp_last_step: step })
      .eq('user_id', cred.user_id)
      .or(`totp_last_step.is.null,totp_last_step.lt.${step}`)
      .select('user_id')
    return data && data.length > 0 ? { ok: true, via: 'totp' } : { ok: false }
  }

  const hash = hashRecoveryCode(normalizeRecoveryCode(code))
  if (!cred.recovery_hashes.some((h) => safeEqual(h, hash))) return { ok: false }
  const remaining = cred.recovery_hashes.filter((h) => !safeEqual(h, hash))
  const { data } = await service
    .from('admin_credentials')
    .update({ recovery_hashes: remaining })
    .eq('user_id', cred.user_id)
    .contains('recovery_hashes', [hash])
    .select('user_id')
  return data && data.length > 0 ? { ok: true, via: 'recovery' } : { ok: false }
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

/**
 * First-time setup is the one moment an attacker holding a stolen app session could claim a staff
 * account, so it re-proves the account: its password when it has one, otherwise a very recent sign-in.
 */
export function accountHasPassword(user: User, invited: boolean): boolean {
  // An emailed invite creates an email identity with no password the person knows, so for them the sign-in
  // through the invite link is the proof instead.
  return !invited && (user.identities ?? []).some((i) => i.provider === 'email')
}

export async function verifyAccountOwnership(user: User, accountPassword: unknown, invited: boolean): Promise<boolean> {
  if (accountHasPassword(user, invited)) {
    if (typeof accountPassword !== 'string' || !accountPassword || !user.email) return false
    const probe = createClient(requireSupabaseUrl(), requireSupabasePublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await probe.auth.signInWithPassword({ email: user.email, password: accountPassword })
    return !error && data.user?.id === user.id
  }
  const last = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0
  return Date.now() - last < FRESH_SIGN_IN_MS
}

export async function allowAttempt(service: ServiceClient, key: string, windowSeconds: number, max: number): Promise<boolean> {
  const { data, error } = await service.rpc('admin_rate_hit', { p_key: key, p_window_seconds: windowSeconds, p_max_hits: max })
  if (error) {
    console.error('[admin/auth] rate-limit rpc failed', error.message)
    return false
  }
  return data !== false
}
