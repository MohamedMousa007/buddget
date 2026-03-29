import type { Dictionary } from '@/lib/i18n'

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
