/** Ensures the select value is still in the payable list, else first payable. */
export function selectedPayableDebtId(payable: { id: string }[], current: string): string {
  if (payable.some((d) => d.id === current)) return current
  return payable[0]?.id ?? ''
}
