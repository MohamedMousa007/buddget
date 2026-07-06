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

/** Log a compact support code for diagnosis without leaking it into user copy. */
function withRef(message: string, code: string): string {
  console.warn(`[auth] ${code}`)
  return message
}

/** Map OAuth start/callback failures to friendly i18n copy with a dev-reference code. */
export function mapOAuthError(
  err: unknown,
  reason: OAuthFailureReason | null,
  t: Dictionary,
): string {
  if (reason === 'cancelled') return t.auth.oauthCancelled
  if (reason === 'exchange_failed' || reason === 'missing_code')
    return withRef(t.auth.oauthFailed, 'EXCHANGE')

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
    return withRef(t.auth.errorNetwork, 'NET')
  }
  if (
    m.includes('provider is not enabled') ||
    m.includes('unsupported provider') ||
    m.includes('validation failed')
  ) {
    return withRef(t.auth.oauthUnavailable, 'PROVIDER')
  }
  if (m.includes('access_denied') || m.includes('cancel')) {
    return t.auth.oauthCancelled
  }
  if (reason === 'provider_error') return withRef(t.auth.oauthFailed, 'PROVIDER')

  // Android: Google plugin not registered in MainActivity / Credential Manager failure
  if (m.includes('main activity') || m.includes('scopes without'))
    return withRef(t.auth.oauthFailed, 'ANDROID_GOOGLE')
  // Apple: Services ID redirect URL missing from Apple Developer
  if (
    m.includes('invalid_request') ||
    m.includes('redirect_uri') ||
    m.includes('redirect url') ||
    m.includes('web redirect')
  )
    return withRef(t.auth.oauthUnavailable, 'APPLE_REDIRECT')
  // Back-button dismiss or 2-minute timeout
  if (m.includes('auth_timeout') || m.includes('sign_in_cancelled')) return t.auth.oauthCancelled
  // Plugin returned no token or stale credential
  if (m.includes('no identity token') || m.includes('credential'))
    return withRef(t.auth.oauthFailed, 'NO_TOKEN')

  return withRef(t.auth.oauthFailed, 'GENERIC')
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

  if (raw) console.warn('[auth] unmapped:', raw)
  return t.auth.errorFallback
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
