/**
 * Registry for hardware-back interception (Android backButton listener).
 * A guard returns true when it handled the press (e.g. opened an
 * unsaved-changes dialog) so navigation must not proceed.
 */
type BackGuard = () => boolean

const guards: BackGuard[] = []

export function registerBackGuard(fn: BackGuard): () => void {
  guards.push(fn)
  return () => {
    const i = guards.indexOf(fn)
    if (i !== -1) guards.splice(i, 1)
  }
}

/** Runs guards last-registered first; true = a guard handled the press. */
export function runBackGuards(): boolean {
  for (let i = guards.length - 1; i >= 0; i--) {
    if (guards[i]()) return true
  }
  return false
}
