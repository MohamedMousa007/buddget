/**
 * Salary dedup: reconcile an incoming income SMS against the user's declared
 * recurring salary so a paycheck SMS does not double-count.
 *
 * `calculateMonthlyIncome` already counts a recurring salary once per period, so
 * a confident match must NOT create a new income row — we only acknowledge
 * receipt. A close-but-off amount (e.g. a raise) asks the user to confirm; an
 * unmatched credit falls through to normal one-time income capture.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type SalaryDecision =
  | { outcome: 'matched'; sourceId: string }
  | { outcome: 'confirm'; sourceId: string }
  | { outcome: 'create' }

const EXACT_TOLERANCE = 0.02 // ±2% → auto-match
const CONFIRM_TOLERANCE = 0.15 // ±2%–15% → ask the user (raise / deduction)
const DAY_WINDOW = 3

export async function matchSalary(
  service: SupabaseClient,
  params: { userId: string; amount: number; currency: string; day: string },
): Promise<SalaryDecision> {
  const { data: sources } = await service
    .from('income_sources')
    .select('id, amount, currency, source_type, is_recurring, recurring_frequency, day_of_month')
    .eq('user_id', params.userId)
    .eq('source_type', 'salary')
    .eq('is_recurring', true)
    .is('deleted_at', null)

  const salaries = sources ?? []
  if (salaries.length === 0) return { outcome: 'create' }

  const smsDom = Number(params.day.slice(8, 10))
  let bestConfirm: string | null = null

  for (const s of salaries) {
    // Cross-currency comparison is unreliable here; only compare like currencies.
    if (s.currency !== params.currency) continue
    if (!s.amount) continue
    const diff = Math.abs(params.amount - s.amount) / s.amount

    // For monthly salaries we can use the expected pay day; biweekly/weekly have
    // no fixed day_of_month, so we rely on amount alone.
    const dayOk =
      s.recurring_frequency !== 'monthly' ||
      s.day_of_month == null ||
      Math.abs(smsDom - s.day_of_month) <= DAY_WINDOW

    if (diff <= EXACT_TOLERANCE && dayOk) return { outcome: 'matched', sourceId: s.id }
    if (diff <= CONFIRM_TOLERANCE) bestConfirm = s.id
  }

  if (bestConfirm) return { outcome: 'confirm', sourceId: bestConfirm }
  return { outcome: 'create' }
}
