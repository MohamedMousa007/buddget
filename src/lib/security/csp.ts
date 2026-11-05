export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // Dev only: React Refresh evaluates modules, so `next dev` never hydrates without it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fcm.googleapis.com https://*.push.services.mozilla.com https://updates.push.services.mozilla.com https://*.notify.windows.com https://web.push.apple.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
