/**
 * Pure, server-runnable evaluation of the time-sensitive notification alerts
 * (recurring debt due / due-tomorrow, month-end). Extracted from the client
 * `useNotifications` logic so the daily cron can emit them as OS push + in-app
 * notifications. No React, no store, no i18n — copy is rendered separately via
 * `renderAlertCopy` against a server dictionary.
 *
 * (Budget-threshold and savings-nudge alerts remain client-side in-app status
 * notifications — they don't need OS push and depend on the full stats engine.)
 */
import { addDays, differenceInDays, format } from 'date-fns'
import { getMonthRange } from '@/lib/utils/calculations'
import type { Dictionary } from '@/lib/i18n/types'

export type AlertType = 'recurring_due' | 'recurring_tomorrow' | 'month_end'

export interface RecurringPaymentLite {
  id: string
  debtId: string
  amount: number
  currency: string
  nextDueDate: string // YYYY-MM-DD
  isActive: boolean
}

export interface EvaluateAlertsInput {
  /** Evaluation instant (injected so the function stays pure/testable). */
  now: Date
  /** Current month as `YYYY-MM`. */
  monthStr: string
  monthStartDay: number
  recurring: RecurringPaymentLite[]
  /** debtId → display name. */
  debtNameById: Record<string, string>
}

export interface AlertDescriptor {
  type: AlertType
  dedupeKey: string
  severity: 'info' | 'warning'
  params: { debtName?: string; amount?: number; currency?: string; daysLeft?: number; recurringId?: string }
}

export function evaluateAlerts(input: EvaluateAlertsInput): AlertDescriptor[] {
  const out: AlertDescriptor[] = []
  const todayYmd = format(input.now, 'yyyy-MM-dd')
  const tomorrowYmd = format(addDays(input.now, 1), 'yyyy-MM-dd')

  for (const r of input.recurring) {
    if (!r.isActive) continue
    const debtName = input.debtNameById[r.debtId]
    if (!debtName) continue

    if (r.nextDueDate === tomorrowYmd) {
      out.push({
        type: 'recurring_tomorrow',
        dedupeKey: `recurring_tomorrow:${r.id}:${tomorrowYmd}`,
        severity: 'info',
        params: { debtName, amount: r.amount, currency: r.currency },
      })
    }
    // Due today (or overdue) — matches client isRecurringDebtDue (<= today).
    if (r.nextDueDate <= todayYmd) {
      out.push({
        type: 'recurring_due',
        dedupeKey: `recurring_due:${r.id}:${todayYmd}`,
        severity: 'warning',
        params: { debtName, amount: r.amount, currency: r.currency, recurringId: r.id },
      })
    }
  }

  // Days left in the active month, evaluated against `input.now` (kept pure for
  // testability — mirrors calculateDaysLeftInMonth which uses the wall clock).
  const { end } = getMonthRange(input.monthStr, input.monthStartDay)
  const daysLeft = Math.max(0, differenceInDays(end, input.now) + 1)
  if (daysLeft >= 0 && daysLeft <= 3) {
    out.push({
      type: 'month_end',
      dedupeKey: `month_end:${input.monthStr}`,
      severity: daysLeft === 0 ? 'warning' : 'info',
      params: { daysLeft },
    })
  }

  return out
}

/** Render localized {title, body} for a descriptor using a server dictionary. */
export function renderAlertCopy(
  dict: Dictionary,
  a: AlertDescriptor,
): { title: string; body: string } {
  const n = dict.notifications
  switch (a.type) {
    case 'recurring_tomorrow':
      return {
        title: a.params.debtName ?? '',
        body: n.recurringTomorrowBody(a.params.debtName ?? '', a.params.amount ?? 0, a.params.currency ?? ''),
      }
    case 'recurring_due':
      return {
        title: a.params.debtName ?? '',
        body: n.recurringDueBody(a.params.debtName ?? '', a.params.amount ?? 0, a.params.currency ?? ''),
      }
    case 'month_end': {
      const d = a.params.daysLeft ?? 0
      return {
        title: d === 0 ? n.monthEndTitleLast : n.monthEndTitleDays(d),
        body: d === 0 ? n.monthEndBodyLast : n.monthEndBodyDays(d),
      }
    }
  }
}
