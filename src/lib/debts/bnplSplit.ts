import type { Currency, Debt } from '@/lib/store/types'

export type BnplSplitIssue = 'funding' | 'firstDue'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Why a "split into installments" purchase cannot be saved as a plan; null when it can. */
export function bnplSplitIssue(input: { fundingMethodId: string; firstDue: string; purchaseDate: string }): BnplSplitIssue | null {
  if (!input.fundingMethodId) return 'funding'
  const valid = ISO_DAY.test(input.firstDue) && !Number.isNaN(Date.parse(`${input.firstDue}T12:00:00`))
  return valid && input.firstDue >= input.purchaseDate ? null : 'firstDue'
}

export type BnplProvider = 'tabby' | 'tamara' | 'other'

/** The installment debt for a split BNPL purchase. `startDate` is the first payment (the reminder's first due), not the purchase date. */
export function bnplPlanDebt(input: {
  title: string
  total: number
  currency: Currency
  provider: BnplProvider
  count: number
  perInstallment: number
  firstDue: string
  paymentMethodId: string
}): Omit<Debt, 'id' | 'createdAt'> {
  return {
    name: input.title,
    person: '',
    startingBalance: input.total,
    currency: input.currency,
    isGold: false,
    receivedVia: 'card',
    debtType: 'installment',
    direction: 'i_owe',
    status: 'active',
    installmentProvider: input.provider,
    installmentCount: input.count,
    installmentFrequency: 'monthly',
    installmentAmount: input.perInstallment,
    startDate: input.firstDue,
    interestFree: true,
    linkedPaymentMethodId: input.paymentMethodId,
  }
}
