const MIN_FUZZY = 3

type Method = { id: string; name: string; closedAt?: string | null }

/** Best-effort match of a free-text payment hint to an open payment method id: exact name first, then a substring either way (3+ letters; a blank name never matches). Null when every method is closed. */
export function matchPaymentMethodForExpense(hint: string | undefined, methods: Method[]): string | null {
  const open = methods.filter((m) => !m.closedAt)
  if (!hint?.trim()) return open.find((m) => m.name === 'Bank Transfer')?.id ?? open[0]?.id ?? null
  const lower = hint.trim().toLowerCase()
  const named = open.filter((m) => m.name.trim())
  const match =
    named.find((m) => m.name.toLowerCase() === lower) ||
    (lower.length >= MIN_FUZZY ? named.find((m) => m.name.toLowerCase().includes(lower)) : undefined) ||
    named.find((m) => m.name.trim().length >= MIN_FUZZY && lower.includes(m.name.trim().toLowerCase()))
  return match?.id ?? open[0]?.id ?? null
}
