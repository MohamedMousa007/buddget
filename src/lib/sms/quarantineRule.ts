/**
 * N16 (code part): one hard signal from one user must not quarantine a global template. A hard signal
 * is near-certain evidence (direction-guard override, zero-variance amount) but a single user can still
 * produce it by accident or abuse; quarantine needs several of them from at least two different users.
 * The SQL (migration 0211, package 3) applies the same two thresholds; keep them in step.
 */
export const QUARANTINE_MIN_HARD_SIGNALS = 2
export const QUARANTINE_MIN_USERS = 2

export function shouldQuarantine(
  hardSignals: ReadonlyArray<{ userId: string | null }>,
  minSignals: number = QUARANTINE_MIN_HARD_SIGNALS,
  minUsers: number = QUARANTINE_MIN_USERS,
): boolean {
  if (hardSignals.length < minSignals) return false
  return new Set(hardSignals.map((s) => s.userId)).size >= minUsers
}
