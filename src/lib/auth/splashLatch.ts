/**
 * Persisted one-shot welcome-splash latch. Stores the userId the welcome
 * screen was last shown for, so a cold app REOPEN (process killed → relaunch)
 * skips the welcome and goes straight to instant cached content. Cleared on
 * sign-out (the key is wiped by `clearBudgetData`), so the next sign-in shows
 * the welcome once. Keyed by userId so an account switch re-shows it.
 *
 * localStorage (not sessionStorage): sessionStorage dies with the process, so
 * it would re-show the welcome on every reopen — the opposite of the goal.
 */
export const SPLASH_DONE_KEY = 'buddget_splash_done'

export function readSplashDone(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(SPLASH_DONE_KEY)
  } catch {
    return null
  }
}

export function writeSplashDone(userId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SPLASH_DONE_KEY, userId)
  } catch {
    /* restricted storage — the in-session React state still latches */
  }
}
