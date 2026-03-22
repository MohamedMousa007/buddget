/** Map Supabase / network errors to user-facing copy (AuthModal). */
export function mapAuthError(err: unknown, context: 'signin' | 'signup' | 'otp' | 'forgot' | 'resend'): string {
  const raw = err instanceof Error ? err.message : String(err)
  const m = raw.toLowerCase()

  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch')) {
    return 'Connection error. Please check your internet and try again.'
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate_limit')) {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }

  if (context === 'signup') {
    if (m.includes('already registered') || m.includes('user already registered') || m.includes('already been registered')) {
      return 'EMAIL_EXISTS'
    }
  }

  if (context === 'signin') {
    if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
      return 'Incorrect password. Try again or reset your password.'
    }
    if (m.includes('email not confirmed')) {
      return 'Please confirm your email first. Resend confirmation code?'
    }
  }

  if (context === 'otp' && m.includes('expired')) {
    return 'This code has expired. Request a new code.'
  }

  return raw || 'Something went wrong. Please try again.'
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
