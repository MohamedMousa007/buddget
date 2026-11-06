import { LEGACY_MAX_AMOUNT } from '@/lib/ai/legacyGuards'
import type { ToolSpec } from '@/lib/buddgy/tools/spec'

/** Numeric tool parameters that carry money or a quantity of something owned. Every one is bounded by `amountError`. */
export const MONEY_PARAMS: ReadonlySet<string> = new Set([
  'amount', 'total', 'outstanding', 'limit', 'target', 'saved', 'monthly', 'balance', 'quantity', 'value', 'size', 'paid', 'monthlyRent',
])

/** Numeric tool parameters that are counts, days or percentages: not money, bounded by their executors. A new numeric param must be added to one of the two sets (the guard test fails otherwise). */
export const NON_MONEY_PARAMS: ReadonlySet<string> = new Set(['karat', 'count', 'dueDay', 'graceDays', 'minPercent', 'billingDay', 'sharePct', 'paydayDays'])

/** One bound for every amount a write tool accepts: the same ceiling add_expense uses (`LEGACY_MAX_AMOUNT`). Zero is left to each executor; negatives, -0, NaN, Infinity and anything above the ceiling are refused. */
export function amountError(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || Object.is(n, -0)) return 'The amount must be a real number, zero or above.'
  if (n > LEGACY_MAX_AMOUNT) return `The amount is too large (max ${LEGACY_MAX_AMOUNT.toLocaleString('en-US')}).`
  return null
}

function scan(schema: ToolSpec['params'], value: unknown): string | null {
  if (schema.type === 'number') return value === undefined ? null : amountError(value)
  if (schema.type === 'array' && schema.items && schema.items.type !== 'number' && schema.items.type !== 'integer' && Array.isArray(value)) {
    for (const item of value) {
      const bad = scan(schema.items, item)
      if (bad) return bad
    }
    return null
  }
  if (schema.type === 'object' && schema.properties && value && typeof value === 'object') {
    for (const [key, sub] of Object.entries(schema.properties)) {
      const field = (value as Record<string, unknown>)[key]
      if ((sub.type === 'number' && !MONEY_PARAMS.has(key)) || field === undefined) continue
      const bad = scan(sub, field)
      if (bad) return bad
    }
  }
  return null
}

/** First amount problem in a write tool's raw arguments, or null. Runs before the executor sees them. */
export function amountArgsError(spec: ToolSpec, args: Record<string, unknown>): string | null {
  return scan(spec.params, args)
}
