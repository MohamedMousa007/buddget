import type { FinanceStore } from '@/lib/store/types'
import { merchantKey } from '@/lib/ai/buddgyLookup'

const DAY_MS = 86_400_000
const recent = (date: string, days: number) => Date.now() - new Date(date).getTime() <= days * DAY_MS

/** Most common value per key, for keys seen at least `min` times, most frequent first. */
function habitual<K>(pairs: [K, string][], min: number): [K, string, number][] {
  const counts = new Map<K, Map<string, number>>()
  for (const [k, v] of pairs) {
    const m = counts.get(k) ?? new Map<string, number>()
    m.set(v, (m.get(v) ?? 0) + 1)
    counts.set(k, m)
  }
  return [...counts]
    .map(([k, m]) => {
      const [v, n] = [...m].sort((a, b) => b[1] - a[1])[0]
      return [k, v, [...m.values()].reduce((a, b) => a + b, 0) >= min ? n : 0] as [K, string, number]
    })
    .filter(([, , n]) => n > 0)
    .sort((a, b) => b[2] - a[2])
}

/**
 * What Buddgy "knows" about how this user lives, derived from their own data
 * plus the facts they asked him to remember. It is what lets "coffee 15" land in
 * the right category on the right card without a follow-up question.
 */
export function buildMemoryBlock(store: FinanceStore, notes: string[]): string {
  const methodName = new Map(store.paymentMethods.map((m) => [m.id, m.name]))
  const last90 = store.expenses.filter((e) => recent(e.date, 90))

  const methodUse = new Map<string, number>()
  for (const e of last90) methodUse.set(e.paymentMethodId, (methodUse.get(e.paymentMethodId) ?? 0) + 1)
  const topMethods = [...methodUse]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => methodName.get(id))
    .filter(Boolean)

  const merchants = habitual(last90.map((e) => [merchantKey(e.description), e.category] as [string, string]), 2)
    .slice(0, 12)
    .map(([m, cat]) => `${m} → ${cat}`)

  const paydays = store.incomeSources
    .filter((s) => s.isRecurring && s.dayOfMonth)
    .map((s) => `${s.name} on day ${s.dayOfMonth}`)

  return [
    topMethods.length ? `- Usually pays with: ${topMethods.join(', ')} (default to the first when unsaid)` : '',
    merchants.length ? `- Usual categories: ${merchants.join('; ')}` : '',
    paydays.length ? `- Paydays: ${paydays.join('; ')}` : '',
    ...notes.map((n) => `- Remembered: ${n}`),
  ].filter(Boolean).join('\n')
}
