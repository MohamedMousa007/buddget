'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { useLocale, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { CheckpointBar, type CheckpointTone } from '@/components/features/goals/CheckpointBar'
import { GoalStatusLine } from '@/components/features/goals/GoalStatusLine'
import { ACTION_LABEL, goalStatusText } from '@/components/features/goals/goalStatusText'
import type { GoalRow } from '@/hooks/useGoalRows'
import type { GoalStatusView } from '@/lib/goals/goalStatus'
import { goalVisual } from '@/lib/goals/goalVisual'
import type { Goal } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { cn } from '@/lib/utils'

export type GoalCardAction = GoalStatusView['button']['action']

const TONE: Record<string, CheckpointTone> = { over: 'over', behind: 'behind', paused: 'paused' }
const PERCENT_COLOR: Record<string, string> = {
  over: 'var(--color-brand-red-text)',
  behind: 'var(--color-brand-amber)',
  paused: 'var(--color-brand-text-secondary)',
}

/** Fixed 192px goal card: identity, amount, checkpoint bar, then exactly one status line and one button. */
export function GoalCard({
  row,
  onOpen,
  onAction,
}: {
  row: GoalRow
  onOpen: (g: Goal) => void
  onAction: (g: Goal, a: GoalCardAction) => void
}) {
  const { goal, current, percent, status } = row
  const t = useT().goals.home
  const hidden = useMask('lists')
  const { locale } = useLocale()
  const { icon: Icon, cat } = goalVisual(goal.category)
  const isLimit = goal.category === 'spending_control'
  const basis = isLimit ? goal.monthlySpendingLimit : goal.targetAmount
  const month = (iso: string) =>
    new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' })
  const dueLine = status.kind === 'paused'
    ? goal.targetDate ? t.pausedWas(month(goal.targetDate)) : ''
    : isLimit ? t.resets(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short' }))
    : goal.targetDate ? month(goal.targetDate) : ''
  return (
    <div className="relative flex h-48 flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 pt-4 text-start shadow-sm transition-transform duration-100 active:scale-[0.98]">
      {/* The card opens through this one button, stretched over the whole card; the footer action sits above it, so no control is nested in another. */}
      <button
        type="button"
        onClick={() => onOpen(goal)}
        className="flex cursor-pointer flex-col gap-3 text-start after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--color-brand-focus)]"
      >
      <span className="flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px]"
          style={{
            color: `var(--color-cat-${cat})`,
            background: `color-mix(in srgb, var(--color-cat-${cat}) 16%, var(--color-brand-card))`,
          }}
          aria-hidden
        >
          <Icon className="size-[22px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold leading-[1.15] text-[var(--color-brand-text-primary)]">{goal.name}</span>
          <span className="mt-0.5 block h-4 truncate font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{dueLine}</span>
        </span>
        <span
          className="font-mono-numbers text-xl font-semibold"
          style={{ color: PERCENT_COLOR[status.kind] ?? 'var(--color-brand-text-primary)' }}
        >
          {percent}%
        </span>
      </span>

      <span className="flex h-6 items-baseline gap-1.5 font-mono-numbers leading-6">
        <span className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
          {hidden ? MASK : formatCurrency(current, goal.currency, false)}
        </span>
        {basis ? (
          <span className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
            {t.ofTarget(hidden ? MASK : formatCurrency(basis, goal.currency, false))}
          </span>
        ) : null}
      </span>

      <CheckpointBar percent={percent} tone={TONE[status.kind] ?? 'default'} nodes={!isLimit} />
      </button>

      <div
        className={cn(
          'mt-auto -mx-4 flex h-14 items-center gap-2 border-t border-[var(--color-brand-border)] pe-3 ps-4',
        )}
      >
        <GoalStatusLine view={status} text={goalStatusText(status, goal, t)} />
        <Button
          size="touch"
          variant={status.button.variant}
          className="relative z-10"
          onClick={() => onAction(goal, status.button.action)}
        >
          {goal.category === 'debt_freedom' && status.button.action === 'addMoney' ? t.actionPay : t[ACTION_LABEL[status.button.action]]}
        </Button>
      </div>
    </div>
  )
}
