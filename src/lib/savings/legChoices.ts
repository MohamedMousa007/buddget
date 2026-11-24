import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { canCarryLeg, resolveAccountLeg } from '@/lib/savings/accountLeg'
import { isOpenAccount } from '@/lib/accounts/kinds'
import { pocketHome } from '@/lib/savings/pocketHome'

type Pocket = Pick<SavingsAccount, 'heldInPaymentMethodId'>

/** Accounts the "From / To account" row may offer: exactly those the store would accept as a ledger leg. */
export function eligibleLegAccountIds(methods: readonly PaymentMethod[], pocket: Pocket, legCurrency: string): string[] {
  return methods.filter((m) => isOpenAccount(m) && canCarryLeg(methods, pocket, m.id, legCurrency)).map((m) => m.id)
}

/** What the row shows first: the primary tracked account when it can carry the leg, else the first one that can. */
export function defaultLegAccountId(methods: readonly PaymentMethod[], pocket: Pocket, legCurrency: string): string | undefined {
  return resolveAccountLeg(methods, pocket, undefined, legCurrency) ?? eligibleLegAccountIds(methods, pocket, legCurrency)[0]
}

/** The account whose own money a deposit sets aside: the open, tracked account holding the pocket. */
function openHolderId(methods: readonly PaymentMethod[], pocket: Pocket): string | undefined {
  const home = pocketHome(pocket, methods)
  const holder = home.kind === 'reserved' ? methods.find((m) => m.id === home.accountId) : undefined
  return holder && isOpenAccount(holder) ? holder.id : undefined
}

/** Add money's "From account": the account holding the pocket first, then every account that can send money to it. */
export function depositSourceIds(methods: readonly PaymentMethod[], pocket: Pocket, legCurrency: string): string[] {
  const holder = openHolderId(methods, pocket)
  return [...(holder ? [holder] : []), ...eligibleLegAccountIds(methods, pocket, legCurrency)]
}

/**
 * What Add money shows first. A pocket held in an account is funded from that account's own money (set aside, nothing
 * moves); the primary account would book a transfer between two accounts the user never asked for.
 */
export function defaultDepositSourceId(methods: readonly PaymentMethod[], pocket: Pocket, legCurrency: string): string | undefined {
  return openHolderId(methods, pocket) ?? defaultLegAccountId(methods, pocket, legCurrency)
}
