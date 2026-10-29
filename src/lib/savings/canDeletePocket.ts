import type { SavingsAccount, UserProfile } from '@/lib/store/types'
import { SYSTEM_VAULT_NAME } from '@/lib/savings/pocketIdentity'

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

/** The default carry pocket and the app's own vault must stay savings pockets of their type: a different type makes them ineligible and the carry silently reroutes. */
export function isTypeLockedPocket(
  profile: Pick<UserProfile, 'defaultCarryPocketId'>,
  pocket: Pick<SavingsAccount, 'id' | 'type' | 'name'>,
): boolean {
  return profile.defaultCarryPocketId === pocket.id || (pocket.type === 'vault' && pocket.name === SYSTEM_VAULT_NAME)
}
