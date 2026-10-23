import type { PaymentMethod, PaymentMethodType } from '@/lib/store/types'

import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

export { DEFAULT_CASH_ID }

/** Types that hold a balance of their own (stored value included). */
const HOLDERS: ReadonlySet<PaymentMethodType> = new Set(['cash', 'bank_account', 'wallet', 'prepaid_card'])
/** Types a card can hang under. Prepaid cards hold money but nothing hangs under them. */
const PARENTS: ReadonlySet<PaymentMethodType> = new Set(['cash', 'bank_account', 'wallet'])

export const holdsBalance = (type: PaymentMethodType): boolean => HOLDERS.has(type)
export const canBeParent = (type: PaymentMethodType): boolean => PARENTS.has(type)
/** Debit cards spend straight out of their parent account. */
export const drawsOnParent = (type: PaymentMethodType): boolean => type === 'debit_card'

export const isTracked = (pm: PaymentMethod): boolean =>
  holdsBalance(pm.type) && pm.openingBalance != null && pm.openingAt != null

/** Live (not closed) balance holders, the rows of the Accounts list. */
/** The in-store cash sentinel is a stand-in for the Cash account, never an account row of its own. */
export const isOpenAccount = (pm: PaymentMethod): boolean => holdsBalance(pm.type) && !pm.closedAt && pm.id !== DEFAULT_CASH_ID
