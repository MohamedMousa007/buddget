/** Map Supabase / network errors to user-facing copy (AuthModal). */
export function mapAuthError(err: unknown, context: 'signin' | 'signup' | 'otp' | 'forgot' | 'resend'): string {
  const raw = err instanceof Error ? err.message : String(err)
  const m = raw.toLowerCase()

  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch')) {
    return 'Can\'t connect right now. Check your internet and try again.'
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate_limit')) {
    return 'Slow down a little — try again in a moment.'
  }

  if (context === 'signup') {
    if (m.includes('already registered') || m.includes('user already registered') || m.includes('already been registered')) {
      return 'EMAIL_EXISTS'
    }
  }

  if (context === 'signin') {
    if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
      return 'That password doesn\'t look right. Try again or reset it.'
    }
    if (m.includes('email not confirmed')) {
      return 'Looks like your email isn\'t confirmed yet. Resend confirmation code?'
    }
  }

  if (context === 'otp' && m.includes('expired')) {
    return 'This code has expired. Request a new one.'
  }

  return raw || 'Oops, something went wrong. Let\'s try again.'
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
