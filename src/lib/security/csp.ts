import { getSupabaseUrl } from '@/lib/supabase/env'

/** Origin of the configured Supabase project (QA-100: never `*.supabase.co`); empty when unset or malformed. */
function supabaseOrigin(): string {
  try {
    return new URL(getSupabaseUrl() ?? '').origin
  } catch {
    return ''
  }
}

/**
 * `admin`: the email editor previews staff-typed image URLs inside a srcdoc iframe, which inherits this policy,
 * so the admin portal alone keeps `https:` images.
 */
export function buildCsp(nonce: string, admin = false): string {
  const supabase = supabaseOrigin()
  const supabaseWs = supabase.replace(/^https:/, 'wss:')
  return [
    "default-src 'self'",
    // Dev only: React Refresh evaluates modules, so `next dev` never hydrates without it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${admin ? 'https:' : supabase}`.trimEnd(),
    "font-src 'self' https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    `connect-src 'self' ${supabase} ${supabaseWs} https://fcm.googleapis.com https://*.push.services.mozilla.com https://updates.push.services.mozilla.com https://*.notify.windows.com https://web.push.apple.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io`.replace(/ {2,}/g, ' '),
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
