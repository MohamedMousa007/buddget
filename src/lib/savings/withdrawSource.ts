type Source = { account: { id: string; currentBalance: number } }

/** The pocket the Withdraw sheet starts on: the one it was opened from, else the first with money, else the first. */
export function defaultWithdrawSource(pockets: readonly Source[], openedFrom?: string | null): string | null {
  return openedFrom ?? (pockets.find((p) => p.account.currentBalance > 0) ?? pockets[0])?.account.id ?? null
}
