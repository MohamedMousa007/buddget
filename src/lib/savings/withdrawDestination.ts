import type { SavingsAccount } from '@/lib/store/types'

/**
 * Account that receives "Back to income" money. A pocket held in an account releases the money inside it
 * (`null` = deliberately none) until the user picks another account; any other pocket takes the picked or default leg.
 */
export function incomeDestination(
  pocket: Pick<SavingsAccount, 'heldInPaymentMethodId'> | undefined,
  pickedAccountId: string | null,
  defaultAccountId: string | null,
): string | null {
  if (pocket?.heldInPaymentMethodId) return pickedAccountId
  return pickedAccountId ?? defaultAccountId
}
