import { createClient } from '@supabase/supabase-js'
import { sendTemplatedEmail } from '@/lib/server/email/send'
import type { ServiceClient } from '@/lib/supabase/service'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'

export const EMAIL_CODE_LENGTH = 6

/** A non-persisting client: sending and checking a code must never create or replace a browser session. */
function probe() {
  return createClient(requireSupabaseUrl(), requireSupabasePublishableKey(), { auth: { persistSession: false, autoRefreshToken: false } })
}

export function normalizeEmailCode(input: unknown): string {
  return typeof input === 'string' ? input.replace(/\D/g, '') : ''
}

/**
 * Mails the staff member a 6-digit code from our own mailer. The code is minted with `generateLink` (nothing is sent by
 * Supabase) and is a normal email OTP, so `verifyEmailCode` checks it the same way.
 */
export async function sendEmailCode(service: ServiceClient, email: string, userId: string): Promise<{ ok: true } | { ok: false; status: number }> {
  const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email })
  const code = data?.properties?.email_otp
  if (error || !code) {
    console.error('[admin/code] mint failed', error?.message)
    return { ok: false, status: 502 }
  }
  const sent = await sendTemplatedEmail('admin_unlock_code', { email, id: userId }, { code }, { service, source: 'admin' })
  return sent.ok ? { ok: true } : { ok: false, status: 502 }
}

/** Single-use (Supabase consumes it on success) and bound to this exact account. */
export async function verifyEmailCode(email: string, input: unknown, userId: string): Promise<boolean> {
  const token = normalizeEmailCode(input)
  if (token.length !== EMAIL_CODE_LENGTH) return false
  const { data, error } = await probe().auth.verifyOtp({ email, token, type: 'email' })
  return !error && data.user?.id === userId
}
