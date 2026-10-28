export type BnplSplitIssue = 'funding' | 'firstDue'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Why a "split into installments" purchase cannot be saved as a plan; null when it can. */
export function bnplSplitIssue(input: { fundingMethodId: string; firstDue: string; purchaseDate: string }): BnplSplitIssue | null {
  if (!input.fundingMethodId) return 'funding'
  const valid = ISO_DAY.test(input.firstDue) && !Number.isNaN(Date.parse(`${input.firstDue}T12:00:00`))
  return valid && input.firstDue >= input.purchaseDate ? null : 'firstDue'
}
