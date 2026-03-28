/** Best-effort match of a free-text payment hint to a stored payment method id. */
export function matchPaymentMethodForExpense(
  hint: string | undefined,
  methods: { id: string; name: string }[]
): string {
  if (!hint) return methods.find((m) => m.name === 'Bank Transfer')?.id || methods[0]?.id || ''
  const lower = hint.toLowerCase()
  const match =
    methods.find((m) => m.name.toLowerCase().includes(lower)) ||
    methods.find((m) => lower.includes(m.name.toLowerCase()))
  return match?.id || methods[0]?.id || ''
}
