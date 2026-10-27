/**
 * The ONE definition of "primary tracked account": the oldest open bank account, else the oldest wallet.
 * Shared by the client (store deposits, scheduler, Buddgy) and the server (month-carry, goal funding).
 */
export function pickPrimaryAccountId<T extends { id: string; type: string; createdAt?: string | null }>(
  eligible: readonly T[],
): string | null {
  const oldest = [...eligible].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  return (oldest.find((r) => r.type === 'bank_account') ?? oldest[0])?.id ?? null
}
