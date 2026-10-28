import type { SiteLocale } from './config'

/** Public website routes live under /en and /ar. Everything else belongs to the app. */
export function isSitePath(pathname: string): boolean {
  return /^\/(en|ar)(\/|$)/.test(pathname)
}

/** Supabase stores its session in `sb-<project>-auth-token` cookies (chunked as `.0`, `.1`). */
export function hasAuthCookie(names: readonly string[]): boolean {
  return names.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n))
}

/** Arabic unless the browser clearly prefers English. */
export function pickSiteLocale(acceptLanguage: string | null): SiteLocale {
  if (!acceptLanguage) return 'ar'
  for (const part of acceptLanguage.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase()
    if (tag.startsWith('ar')) return 'ar'
    if (tag.startsWith('en')) return 'en'
  }
  return 'ar'
}

/**
 * The app owns `/` for signed-in people. A visitor with no session sees the website instead,
 * served from /ar or /en without changing the address bar.
 */
export function siteHomeRewrite(input: { pathname: string; hasSession: boolean; acceptLanguage: string | null }): string | null {
  if (input.pathname !== '/' || input.hasSession) return null
  return `/${pickSiteLocale(input.acceptLanguage)}`
}

/**
 * Brochure pages are statically generated, so Next's inline hydration scripts carry no nonce.
 * They hold no account data, which is what makes allowing inline scripts acceptable here.
 */
export const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')
