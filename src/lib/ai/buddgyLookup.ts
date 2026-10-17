import type { FinanceStore } from '@/lib/store/types'
import { expenseAmountInBase } from '@/lib/utils/calculations'

/**
 * A question Buddgy asks of the user's own data when LIVE_APP_DATA isn't enough
 * ("what did I spend at Talabat last month?"). The model emits it as a `lookup`
 * action; it runs here, on-device, and only the summary goes back to the model —
 * never the whole ledger.
 */
export interface LookupQuery {
  kind?: 'expenses' | 'income' | 'subscriptions'
  from?: string
  to?: string
  category?: string
  text?: string
  paymentMethod?: string
  groupBy?: 'category' | 'merchant' | 'month' | 'day' | 'none'
}

const MAX_ROWS = 12
const r = (n: number) => Math.round(n * 100) / 100
const has = (hay: string, needle?: string) => !needle || hay.toLowerCase().includes(needle.toLowerCase())
const inRange = (date: string, q: LookupQuery) => (!q.from || date >= q.from) && (!q.to || date <= q.to)

/** First two words, lower-cased — "Talabat order #123" and "talabat" group together. */
export function merchantKey(description: string): string {
  return description.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).join(' ')
}

export function runLookup(store: FinanceStore, q: LookupQuery): string {
  const base = store.settings.baseCurrency
  const range = `${q.from ?? 'start'} → ${q.to ?? 'today'}`

  if (q.kind === 'subscriptions') {
    const subs = store.subscriptions
    if (!subs.length) return 'No tracked subscriptions.'
    // Status matters: a cancelled sub listed bare would be reported to the user as a live charge.
    return subs.map((s) => `${s.name}: ${s.currency} ${s.amount} / ${s.billingCycle} (${s.status})`).join('\n')
  }

  if (q.kind === 'income') {
    const events = store.incomeEvents.filter((e) => inRange(e.receivedDate, q) && has(e.name, q.text))
    if (!events.length) return `No income found for ${range}.`
    return [
      `Income ${range}: ${events.length} entries`,
      ...events.slice(0, MAX_ROWS).map((e) => `${e.receivedDate} · ${e.name} · ${e.currency} ${e.amount} · ${e.status}`),
    ].join('\n')
  }

  const methodIds = q.paymentMethod
    ? new Set(store.paymentMethods.filter((m) => has(m.name, q.paymentMethod)).map((m) => m.id))
    : null
  const rows = store.expenses
    .filter((e) => inRange(e.date, q) && has(e.category, q.category) && has(e.description, q.text))
    .filter((e) => !methodIds || methodIds.has(e.paymentMethodId))
    .map((e) => ({ e, amount: expenseAmountInBase(e, base, store.exchangeRates) }))
    .filter((x) => x.amount > 0)
  if (!rows.length) return `No expenses match (${range}).`

  const total = rows.reduce((sum, x) => sum + x.amount, 0)
  const lines = [`Expenses ${range}: ${rows.length} items, total ${base} ${r(total)}`]

  const groupBy = q.groupBy ?? 'category'
  if (groupBy !== 'none') {
    const key = (x: (typeof rows)[number]) =>
      groupBy === 'category' ? x.e.category
      : groupBy === 'merchant' ? merchantKey(x.e.description)
      : groupBy === 'month' ? x.e.date.slice(0, 7)
      : x.e.date
    const groups = new Map<string, { sum: number; n: number }>()
    for (const x of rows) {
      const g = groups.get(key(x)) ?? { sum: 0, n: 0 }
      g.sum += x.amount
      g.n++
      groups.set(key(x), g)
    }
    const sorted = [...groups].sort((a, b) => (groupBy === 'month' || groupBy === 'day' ? a[0].localeCompare(b[0]) : b[1].sum - a[1].sum))
    lines.push(`By ${groupBy}:`, ...sorted.slice(0, MAX_ROWS).map(([k, g]) => `- ${k}: ${base} ${r(g.sum)} (${g.n})`))
  }

  const largest = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 8)
  lines.push('Largest:', ...largest.map((x) => `- ${x.e.date} · ${x.e.description} · ${base} ${r(x.amount)} · ${x.e.category}`))
  return lines.join('\n')
}
