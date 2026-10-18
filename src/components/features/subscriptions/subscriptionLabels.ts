import { CircleHelp, MessageSquare, Zap, type LucideIcon } from 'lucide-react'
import type { SubscriptionsCopy } from '@/lib/i18n/subscriptionsCopy'
import type { Chip, AmountNote } from '@/lib/subscriptions/subscriptionRows'
import type { SubscriptionBillingCycle, SubscriptionTracking } from '@/lib/store/types'
import type { PriceLabel } from '@/lib/subscriptions/catalogDisplay'
import { formatFixed2, formatWhole } from '@/lib/utils/formatters'

export const TRACKING_ICON: Record<SubscriptionTracking, LucideIcon> = {
  sms: MessageSquare,
  ask: CircleHelp,
  log: Zap,
}

/** Short date: "19 Oct" / "19 أكتوبر". */
export type ShortDate = (iso: string) => string

export function chipLabel(chip: Chip, ui: SubscriptionsCopy, shortDate: ShortDate): string {
  const c = ui.chips
  switch (chip.key) {
    case 'inDays':
      return c.inDays(chip.n ?? 0)
    case 'today':
      return c.today
    case 'trialEnds':
      return c.trialEnds
    case 'paused':
      return c.paused
    case 'ends':
      return c.ends(chip.date ? shortDate(chip.date) : '')
    case 'expected':
      return c.expected
    case 'price':
      return c.price(signedPct(chip.n ?? 0))
    case 'planChanges':
      return c.planChanges(chip.date ? shortDate(chip.date) : '')
    case 'failed':
      return c.failed
    case 'shared':
      return c.shared(chip.n ?? 2)
    case 'estimate':
      return c.estimate
    case 'yearly':
      return c.yearly
    case 'active':
      return c.active
  }
}

export const signedPct = (n: number) => `${n > 0 ? '+' : ''}${n}%`

export function noteLabel(note: AmountNote, ui: SubscriptionsCopy, usdSymbol: (a: number, c: string) => string): string {
  switch (note.kind) {
    case 'foreign': {
      const base = usdSymbol(note.amount, note.currency)
      return note.fxDrift != null ? ui.notes.fxDrift(base, signedPct(Math.round(note.fxDrift * 100))) : base
    }
    case 'perMonth':
      return ui.notes.perMonth(formatFixed2(note.amount))
    case 'was':
      return ui.notes.was(formatFixed2(note.amount))
    case 'myShare':
      return ui.notes.myShareOf(formatFixed2(note.of))
  }
}

/** The headline amount of a row: `≈ 1,069` for an estimate, `190.00` otherwise. */
export const rowAmount = (amount: number, approx: boolean) => (approx ? `≈ ${formatWhole(amount)}` : formatFixed2(amount))

export function cycleSuffix(cycle: SubscriptionBillingCycle, ui: SubscriptionsCopy): string {
  const a = ui.add
  return { weekly: a.perWeekShort, monthly: a.perMonthShort, quarterly: a.perQuarterShort, semiannual: a.perHalfYearShort, yearly: a.perYearShort }[cycle]
}

export function cycleWord(cycle: SubscriptionBillingCycle, ui: SubscriptionsCopy): string {
  const d = ui.detail
  return { weekly: d.perWeek, monthly: d.perMonth, quarterly: d.perQuarter, semiannual: d.perHalfYear, yearly: d.perYear }[cycle]
}

/** EGP reads ج.م in Arabic; every other code is shown as is. */
export const currencyLabel = (code: string, locale: string) => (code === 'EGP' && locale === 'ar' ? 'ج.م' : code)

/** What a catalog tile quotes: `EGP 190.00`, `≈ EGP 99.00`, `≈ $20`. */
export function tilePriceText(p: PriceLabel, locale: string): string {
  if (p.currency === 'USD') return `≈ $${formatWhole(p.amount)}`
  return `${p.approx ? '≈ ' : ''}${currencyLabel(p.currency, locale)} ${formatFixed2(p.amount)}`
}
