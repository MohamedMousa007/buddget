/**
 * Session-scoped guard that prevents each `useHydrate*` hook from blindly
 * re-fetching (and overwriting) state on every page navigation.
 *
 * Before: routing from `/` → `/expenses` → `/` re-runs `useHydrateExpenses`
 * three times. Each run does a blind `setState({expenses: serverRows})` —
 * if the user has any unsynced local edits (pending in the debounce
 * window), they get clobbered by the server copy that never received
 * them. Sign-in is even worse: `clearBudgetData` wipes localStorage,
 * then every hydrate hook races to re-populate from the server.
 *
 * After: the first run per `{userId, sliceKey}` hits the network; every
 * subsequent mount is a no-op until `resetHydrationGuard()` is called
 * (sign-out, user switch).
 */

const hydrated = new Set<string>()

function keyOf(userId: string, slice: string): string {
  return `${userId}::${slice}`
}

export function hasHydrated(userId: string, slice: string): boolean {
  return hydrated.has(keyOf(userId, slice))
}

export function markHydrated(userId: string, slice: string): void {
  hydrated.add(keyOf(userId, slice))
}

/** Called by `clearBudgetData` on sign-out so the next sign-in hydrates
 *  from scratch. */
export function resetHydrationGuard(): void {
  hydrated.clear()
}
