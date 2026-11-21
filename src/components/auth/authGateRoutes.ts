/**
 * Routes the auth gate renders as-is for signed-out visitors: the inbound auth flow (reset password, callback),
 * the legal pages linked from the landing screen, and the invite landing `/i/<code>` (it saves the code, then sends
 * the visitor into the auth flow itself).
 */
const BYPASS_PREFIXES = ['/reset-password', '/auth/callback', '/legal', '/i/'] as const

export function isAuthGateBypassRoute(pathname: string): boolean {
  return BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
