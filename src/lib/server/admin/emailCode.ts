import { createClient } from '@supabase/supabase-js'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'

export const EMAIL_CODE_LENGTH = 6

/** A non-persisting client: sending and checking a code must never create or replace a browser session. */
function probe() {
  return createClient(requireSupabaseUrl(), requireSupabasePublishableKey(), { auth: { persistSession: false, autoRefreshToken: false } })
}

export function normalizeEmailCode(input: unknown): string {
  return typeof input === 'string' ? input.replace(/\D/g, '') : ''
}

/** Mails the staff member the same 6-digit code the app uses for email sign-in. */
export async function sendEmailCode(email: string): Promise<{ ok: true } | { ok: false; status: number }> {
  const { error } = await probe().auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  if (!error) return { ok: true }
  console.error('[admin/code] send failed', error.message)
  return { ok: false, status: error.status === 429 ? 429 : 502 }
}

/** Single-use (Supabase consumes it on success) and bound to this exact account. */
export async function verifyEmailCode(email: string, input: unknown, userId: string): Promise<boolean> {
  const token = normalizeEmailCode(input)
  if (token.length !== EMAIL_CODE_LENGTH) return false
  const { data, error } = await probe().auth.verifyOtp({ email, token, type: 'email' })
  return !error && data.user?.id === userId
}
