import type { BudgetBlock } from '@/lib/store/types'
import { BLOCK_META } from '@/lib/budget/blocks'

export type LineStatusKind =
  | 'ok' | 'near' | 'over' | 'unfunded' | 'unbudgetedSpend' | 'dueSoon' | 'paid' | 'drifted' | 'locked'

export type LineAction = 'review' | 'raiseOrCap' | 'addLine' | 'pay' | 'update' | 'open' | 'none'

export interface LineStatusInput {
  block: BudgetBlock
  planned: number
  spent: number
  mode: 'plan' | 'month'
  dayOfCycle: number
  daysInCycle: number
  /** Cycle day (1-based, same scale as `dayOfCycle`) the bill falls due. */
  dueDay: number | null
  paid: boolean
  /** Live linked total minus the stored amount; 0 when the line is not linked. */
  linkedDrift: number
  locked: boolean
  essential: boolean
  averageSpend: number | null
  /** Ledger spend that no line claims. */
  unbudgeted: boolean
  /** Months in a row the line has ended over its cap. */
  hasHistoryOverCap: number
}

export interface LineStatusView {
  kind: LineStatusKind
  icon: string
  tone: 'ok' | 'warn' | 'bad' | 'pri' | 'mut'
  button: { action: LineAction; variant: 'default' | 'outline' | 'ghost' | 'destructive' }
  /** Values for the localized line. */
  params: { percent?: number; daysLeft?: number; delta?: number; overBy?: number; months?: number; average?: number }
}

export const NEAR_CAP_RATIO = 0.85
export const DUE_SOON_DAYS = 7
export const DRIFT_TOLERANCE = 0.5
const REPEATED_OVER_MONTHS = 3

function view(
  kind: LineStatusKind,
  icon: string,
  tone: LineStatusView['tone'],
  action: LineAction,
  variant: LineStatusView['button']['variant'],
  params: LineStatusView['params'] = {}
): LineStatusView {
  return { kind, icon, tone, button: { action, variant }, params }
}

/** One status and one action per line. Precedence: over > unbudgetedSpend > near > drifted > dueSoon > unfunded > paid > locked > ok. */
export function getLineStatus(i: LineStatusInput): LineStatusView {
  const tracking = i.mode === 'month'
  const average = i.averageSpend != null ? { average: i.averageSpend } : {}

  if (tracking) {
    if (i.unbudgeted && i.spent > 0) {
      return view('unbudgetedSpend', 'circle-help', 'warn', 'addLine', 'default', { overBy: i.spent, ...average })
    }
    if (i.planned > 0 && i.spent > i.planned) {
      const months = i.hasHistoryOverCap
      return view(
        'over', 'triangle-alert', 'bad', 'raiseOrCap',
        months >= REPEATED_OVER_MONTHS ? 'destructive' : 'outline',
        { overBy: i.spent - i.planned, percent: Math.round((i.spent / i.planned) * 100), months, ...average }
      )
    }
    // A bill that is fully paid is on cap by definition, not close to it.
    if (!i.paid && i.planned > 0 && i.spent >= i.planned * NEAR_CAP_RATIO) {
      return view('near', 'gauge', 'warn', 'review', 'outline', { percent: Math.round((i.spent / i.planned) * 100), ...average })
    }
  }

  if (Math.abs(i.linkedDrift) > DRIFT_TOLERANCE) {
    return view('drifted', 'refresh-cw', 'warn', 'update', 'outline', { delta: i.linkedDrift })
  }

  if (tracking && i.dueDay != null && !i.paid && i.dueDay - i.dayOfCycle <= DUE_SOON_DAYS) {
    const daysLeft = i.dueDay - i.dayOfCycle
    return view('dueSoon', 'calendar-clock', daysLeft < 0 ? 'bad' : 'warn', 'pay', 'default', { daysLeft })
  }

  if (i.planned === 0 && (i.essential || BLOCK_META[i.block].linked)) {
    return view('unfunded', 'circle-dashed', 'warn', 'review', 'outline')
  }

  if (tracking && i.paid) return view('paid', 'check', 'ok', 'none', 'ghost')

  if (!tracking && i.locked) return view('locked', 'lock', 'mut', 'none', 'ghost')

  return view('ok', 'check', 'ok', 'none', 'ghost')
}
