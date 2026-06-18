import type { Dictionary } from '@/lib/i18n'

export type OAuthFailureReason =
  | 'cancelled'
  | 'exchange_failed'
  | 'missing_code'
  | 'provider_error'
  | 'unknown'

/** Normalise callback `?reason=` values from `/auth/callback` redirects. */
export function mapOAuthCallbackReason(reason: string | null | undefined): OAuthFailureReason {
  if (!reason) return 'unknown'
  const r = reason.toLowerCase()
  if (r === 'access_denied' || r.includes('cancel')) return 'cancelled'
  if (r === 'exchange_failed') return 'exchange_failed'
  if (r === 'missing_code') return 'missing_code'
  return 'provider_error'
}

/** Map OAuth start/callback failures to friendly i18n copy. */
export function mapOAuthError(
  err: unknown,
  reason: OAuthFailureReason | null,
  t: Dictionary,
): string {
  if (reason === 'cancelled') return t.auth.oauthCancelled
  if (reason === 'exchange_failed' || reason === 'missing_code') return t.auth.oauthFailed

  const raw =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : err
          ? String(err)
          : ''
  const m = raw.toLowerCase()

  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch')) {
    return t.auth.errorNetwork
  }
  if (
    m.includes('provider is not enabled') ||
    m.includes('unsupported provider') ||
    m.includes('validation failed')
  ) {
    return t.auth.oauthUnavailable
  }
  if (m.includes('access_denied') || m.includes('cancel')) {
    return t.auth.oauthCancelled
  }
  if (reason === 'provider_error') return t.auth.oauthFailed

  return raw || t.auth.oauthFailed
}

/** Map Supabase / network errors to user-facing copy (AuthModal). */
export function mapAuthError(err: unknown, context: 'signin' | 'signup' | 'otp' | 'forgot' | 'resend', t: Dictionary): string {
  const raw = err instanceof Error ? err.message : String(err)
  const m = raw.toLowerCase()

  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch')) {
    return t.auth.errorNetwork
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate_limit')) {
    return t.auth.errorRateLimit
  }
  if (m.includes('sending confirmation email') || m.includes('error sending')) {
    return t.auth.errorEmailSendFailed
  }

  if (context === 'signup') {
    if (m.includes('already registered') || m.includes('user already registered') || m.includes('already been registered')) {
      return 'EMAIL_EXISTS'
    }
  }

  if (context === 'signin') {
    if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
      return t.auth.errorBadPassword
    }
    if (m.includes('email not confirmed')) {
      return t.auth.errorUnconfirmed
    }
  }

  if (context === 'otp' && m.includes('expired')) {
    return t.auth.errorOtpExpired
  }

  return raw || t.auth.errorFallback
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
