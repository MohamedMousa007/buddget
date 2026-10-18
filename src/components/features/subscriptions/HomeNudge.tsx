'use client'

import { Clock, MessageSquare, Repeat, TrendingUp, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Nudge } from '@/lib/subscriptions/subscriptionNudges'
import { money2 } from '@/lib/subscriptions/subscriptionFormat'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'

const ICON = { ask: MessageSquare, price: TrendingUp, trial: Clock, plan: Repeat, still: MessageSquare } as const

/**
 * The one nudge on the home: elevated surface, never red. Price rises are amber (money
 * moved); everything else is teal ink.
 */
export function HomeNudge({ nudge, onOpen }: { nudge: Nudge; onOpen: (subId: string) => void }) {
  const t = useT()
  const ui = t.subscriptions.ui.nudge
  const dismiss = useSettingsStore((s) => s.dismissBanner)
  const { markPaid, adopt, applyPlan } = useFinanceStore(
    useShallow((s) => ({
      markPaid: s.markSubscriptionPaid,
      adopt: s.adoptSubscriptionPrice,
      applyPlan: s.applyPendingPlanChange,
    })),
  )
  const { row, kind } = nudge
  const { sub } = row
  const Icon = ICON[kind]

  const text =
    kind === 'price'
      ? ui.price(sub.planName ? `${sub.name} ${sub.planName}` : sub.name, money2(row.priceChange?.to ?? sub.amount))
      : kind === 'ask'
        ? ui.ask(sub.name)
        : kind === 'trial'
          ? ui.trial(sub.name, Math.max(0, differenceInCalendarDays(parseISO((sub.trialEnd ?? '').slice(0, 10)), startOfDay(new Date()))))
          : kind === 'plan'
            ? ui.plan(sub.name, sub.planName ?? '')
            : ui.still(sub.name)

  const actions: { label: string; run: () => void }[] =
    kind === 'price'
      ? [{ label: ui.adopt, run: () => adopt(sub.id, row.priceChange?.to ?? sub.amount) }]
      : kind === 'ask'
        ? [
            { label: ui.paid, run: () => markPaid(sub.id) },
            { label: ui.notYet, run: () => dismiss(nudge.key) },
          ]
        : kind === 'plan'
          ? [{ label: t.subscriptions.ui.detail.applyPlan, run: () => applyPlan(sub.id) }]
          : [{ label: ui.review, run: () => onOpen(sub.id) }]

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2.5">
      <Icon
        className={kind === 'price' ? 'size-[18px] shrink-0 text-[var(--color-brand-amber)]' : 'size-[18px] shrink-0 text-[var(--color-brand-primary-ink)]'}
        strokeWidth={1.75}
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-[13px] text-[var(--color-brand-text-primary)]">{text}</p>
      {actions.map((a) => (
        <Button
          key={a.label}
          variant="link"
          size="touch"
          onClick={a.run}
          className="px-2 text-[13px] font-semibold text-[var(--color-brand-primary-ink)] no-underline"
        >
          {a.label}
        </Button>
      ))}
      <IconButton size="sm" aria-label={ui.dismiss} onClick={() => dismiss(nudge.key)}>
        <X strokeWidth={1.75} />
      </IconButton>
    </div>
  )
}
