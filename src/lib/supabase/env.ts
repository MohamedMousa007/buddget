/**
 * Supabase env (API keys v2): publishable (client / RLS) + secret (server only).
 * Accepts legacy `*_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` for older deploys.
 * @see https://supabase.com/docs/guides/api/api-keys
 */

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined
}

/** Public publishable key — safe in browser / Capacitor bundle; RLS must protect data. */
export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  )
}

/** Server-only secret key — bypasses RLS; never `NEXT_PUBLIC_*` or client imports. */
export function getSupabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  )
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey())
}

export function requireSupabaseUrl(): string {
  const url = getSupabaseUrl()
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  return url
}

export function requireSupabasePublishableKey(): string {
  const key = getSupabasePublishableKey()
  if (!key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    )
  }
  return key
}

export function requireSupabaseSecretKey(): string {
  const key = getSupabaseSecretKey()
  if (!key) {
    throw new Error('Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)')
  }
  return key
}
