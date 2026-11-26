import type { Dictionary } from '@/lib/i18n'
import type { PaydayState } from '@/lib/income/paydaySummary'

export type PaydayBadgeVariant = 'positive' | 'warning' | 'negative' | 'brand' | 'muted'

/** The chip a payday shows on its card, in the history and on the actions card: one wording per state. */
export function paydayBadge(st: PaydayState, t: Dictionary, dueLabel: string): { variant: PaydayBadgeVariant; label: string } {
  switch (st.kind) {
    case 'received': return { variant: 'positive', label: t.income.statusReceived }
    case 'arrivedLate': return { variant: 'warning', label: t.paydays.arrivedLateShort(st.days) }
    case 'partial': return { variant: 'brand', label: t.income.statusPartial }
    // One look for every missed payday, marked or not: the negative tone (readable on cards and the band alike).
    case 'missed': return { variant: 'negative', label: t.income.statusMissed }
    case 'late': return { variant: 'warning', label: t.income.daysLateChip(st.days) }
    case 'due': return { variant: 'muted', label: t.paydays.dueOn(dueLabel) }
  }
}
