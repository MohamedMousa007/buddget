export interface CardDue {
  /** This cycle's card charges still owed: never more than the card's outstanding balance, so a paid-off card owes nothing. */
  regularDue: number
  installmentDue: number
  allDue: number
  /** Balance left once the cycle's charges are paid. Instalments are separate debts: they were never part of the outstanding. */
  after: number
}

const cents = (n: number) => Math.round(n * 1000) / 1000

export function cardDue(input: { outstanding: number; cycleCharges: number; installmentDue: number }): CardDue {
  const regularDue = cents(Math.max(0, Math.min(input.cycleCharges, input.outstanding)))
  return {
    regularDue,
    installmentDue: input.installmentDue,
    allDue: cents(regularDue + input.installmentDue),
    after: cents(Math.max(0, input.outstanding - regularDue)),
  }
}
