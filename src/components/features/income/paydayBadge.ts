import type { Dictionary } from '@/lib/i18n'
import type { PaydayState } from '@/lib/income/paydaySummary'
import type { PaydayBadgeVariant } from './PaydayCard'

/** The chip a payday shows on its card, in the history and on the actions card: one wording per state. */
export function paydayBadge(st: PaydayState, t: Dictionary, dueLabel: string): { variant: PaydayBadgeVariant; label: string } {
  switch (st.kind) {
    case 'received': return { variant: 'positive', label: t.income.statusReceived }
    case 'arrivedLate': return { variant: 'warning', label: t.paydays.arrivedLateShort(st.days) }
    case 'partial': return { variant: 'brand', label: t.income.statusPartial }
    // Unanswered past its grace: amber, it still wants a Received or Missed; a marked one is settled and muted.
    case 'missed': return { variant: st.marked ? 'muted' : 'warning', label: t.income.statusMissed }
    case 'late': return { variant: 'warning', label: t.income.daysLateChip(st.days) }
    case 'due': return { variant: 'muted', label: t.paydays.dueOn(dueLabel) }
  }
}
