/**
 * Paths rendered instantly from memory by `AppViewRouter` (no App Router
 * segment fetch → structurally cannot wedge). Everything NOT listed here
 * (admin, legal, reset-password, offline, install, setup, redirect stubs) is
 * reached by a full document load via `navigate()`'s hard-nav branch — those
 * have their own layout/session bootstrap and load fresh, so they never wedge
 * either. Keep in sync with the component map in `AppViewRouter`.
 */
export const SHELL_PATHS = [
  '/',
  '/expenses',
  '/debts',
  '/income',
  '/savings',
  '/subscriptions',
  '/goals',
  '/reports',
  '/budget-setup',
  '/notifications',
  '/settings',
  '/settings/profile',
  '/settings/account',
  '/settings/currency',
  '/settings/display',
  '/settings/data',
  '/settings/sms',
] as const

const SHELL_PATH_SET: ReadonlySet<string> = new Set(SHELL_PATHS)

export function isShellPath(path: string): boolean {
  return SHELL_PATH_SET.has(path)
}
