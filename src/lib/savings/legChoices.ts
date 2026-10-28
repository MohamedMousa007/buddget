import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { canCarryLeg, resolveAccountLeg } from '@/lib/savings/accountLeg'
import { isOpenAccount } from '@/lib/accounts/kinds'

type Pocket = Pick<SavingsAccount, 'heldInPaymentMethodId'>

/** Accounts the "From / To account" row may offer: exactly those the store would accept as a ledger leg. */
export function eligibleLegAccountIds(methods: readonly PaymentMethod[], pocket: Pocket, legCurrency: string): string[] {
  return methods.filter((m) => isOpenAccount(m) && canCarryLeg(methods, pocket, m.id, legCurrency)).map((m) => m.id)
}

/** What the row shows first: the primary tracked account when it can carry the leg, else the first one that can. */
export function defaultLegAccountId(methods: readonly PaymentMethod[], pocket: Pocket, legCurrency: string): string | undefined {
  return resolveAccountLeg(methods, pocket, undefined, legCurrency) ?? eligibleLegAccountIds(methods, pocket, legCurrency)[0]
}
