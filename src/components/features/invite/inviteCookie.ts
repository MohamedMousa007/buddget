/**
 * The invite code's cookie, kept free of app imports so the proxy (Edge/Node middleware) can set it.
 * The `/i/<code>` request sets it on the server, as the old link route did, so the code survives a tap on
 * "Create your account" that lands before the page's script has loaded (QA R11).
 */

/** Set by the `/i/<code>` page, read once by the app and copied into storage. */
export const INVITE_COOKIE = 'buddget_invite'
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** A code as the server stores it ("LAYLA-7K2", "AB-7K2"): upper case, letters and digits around one hyphen. Null when it cannot be one. */
export function normalizeInviteCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase()
  return /^[A-Z0-9]{1,12}-[A-Z0-9]{2,8}$/.test(code) ? code : null
}

/** The invite code an `/i/<code>` path carries, or null for any other path or a link that cannot be a code. */
export function inviteCodeFromPath(pathname: string): string | null {
  const m = /^\/i\/([^/]+)\/?$/.exec(pathname)
  if (!m) return null
  try {
    return normalizeInviteCode(decodeURIComponent(m[1]))
  } catch {
    return null
  }
}

/** The cookie the proxy writes for an invite path: same name, value, age and flags as the page's own client write. */
export function inviteCookieFor(pathname: string, https: boolean): { name: string; value: string; options: { maxAge: number; path: string; sameSite: 'lax'; secure: boolean; httpOnly: false } } | null {
  const code = inviteCodeFromPath(pathname)
  if (!code) return null
  return { name: INVITE_COOKIE, value: code, options: { maxAge: INVITE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax', secure: https, httpOnly: false } }
}
