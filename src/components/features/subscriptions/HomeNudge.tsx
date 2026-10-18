'use client'

import { Clock, MessageSquare, Repeat, TrendingUp } from 'lucide-react'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Nudge } from '@/lib/subscriptions/subscriptionNudges'
import { formatFixed2 } from '@/lib/utils/formatters'

const ICON = { ask: MessageSquare, price: TrendingUp, trial: Clock, plan: Repeat, still: MessageSquare } as const

/**
 * The one nudge on the home, as the shared inline `PromptBanner`. A price rise is amber (money
 * moved); everything else is brand. Never red.
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
  const name = sub.planName ? `${sub.name} ${sub.planName}` : sub.name

  const title =
    kind === 'price'
      ? ui.price(name, formatFixed2(row.priceChange?.to ?? sub.amount))
      : kind === 'ask'
        ? ui.ask(sub.name)
        : kind === 'trial'
          ? ui.trial(sub.name, Math.max(0, differenceInCalendarDays(parseISO((sub.trialEnd ?? '').slice(0, 10)), startOfDay(new Date()))))
          : kind === 'plan'
            ? ui.plan(sub.name, sub.planName ?? '')
            : ui.still(sub.name)

  const confirm =
    kind === 'price'
      ? { label: ui.adopt, run: () => adopt(sub.id, row.priceChange?.to ?? sub.amount) }
      : kind === 'ask'
        ? { label: ui.paid, run: () => markPaid(sub.id) }
        : kind === 'plan'
          ? { label: t.subscriptions.ui.detail.applyPlan, run: () => applyPlan(sub.id) }
          : { label: ui.review, run: () => onOpen(sub.id) }

  return (
    <PromptBanner
      tone={kind === 'price' ? 'warning' : 'brand'}
      icon={<Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />}
      title={title}
      confirmLabel={confirm.label}
      onConfirm={confirm.run}
      dismissLabel={kind === 'ask' ? ui.notYet : ui.dismiss}
      onDismiss={() => dismiss(nudge.key)}
    />
  )
}
