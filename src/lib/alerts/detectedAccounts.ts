import type { DetectedAccount } from '@/hooks/usePaymentMethodDetector'

/**
 * The accounts still waiting for an answer: the detector's list minus the ones the user said "Not mine" to (synced in
 * `promptState`, or hidden on this phone) and the ones hidden for the Undo window. One function so the row, the avatar
 * dot, the Inbox and the sheet can never disagree about how many there are.
 */
export function unsettledAccounts(
  found: readonly DetectedAccount[],
  settled: Record<string, string> | undefined,
  dismissed: readonly string[],
  hidden?: ReadonlySet<string>,
): DetectedAccount[] {
  return found.filter((a) => !settled?.[a.key] && !dismissed.includes(a.key) && !hidden?.has(a.key))
}
