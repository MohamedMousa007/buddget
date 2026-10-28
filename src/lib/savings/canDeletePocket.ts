import type { SavingsAccount, UserProfile } from '@/lib/store/types'

export type PocketDeleteVerdict = { ok: true } | { ok: false; reason: 'default' | 'only' }

export function canDeletePocket(
  state: { savingsAccounts: SavingsAccount[]; profile: Pick<UserProfile, 'defaultCarryPocketId'> },
  id: string,
): PocketDeleteVerdict {
  const pocket = state.savingsAccounts.find((a) => a.id === id)
  if (!pocket) return { ok: true }
  if (pocket.category === 'savings' && !state.savingsAccounts.some((a) => a.id !== id && a.category === 'savings')) {
    return { ok: false, reason: 'only' }
  }
  if (state.profile.defaultCarryPocketId === id) return { ok: false, reason: 'default' }
  return { ok: true }
}
