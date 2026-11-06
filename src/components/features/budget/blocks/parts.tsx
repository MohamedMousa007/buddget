'use client'

import type { ReactNode } from 'react'
import {
  CircleAlert, CircleCheck, CircleDashed, CircleHelp, Gauge, Lock, RefreshCw, TriangleAlert, CalendarClock,
  Plus, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LineIcon } from '@/components/features/budget/LineIcon'
import { TintedTile } from '@/components/features/budget/TintedTile'
import { useBudgetBlocksCopy } from '@/components/features/budget/useBlocksCopy'
import { BLOCK_META } from '@/lib/budget/blocks'
import { lineIconKey } from '@/lib/budget/lineIcons'
import type { LineAction, LineStatusView } from '@/lib/budget/lineStatus'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import type { StatusTextParams } from '@/lib/i18n/budgetPage/blocksCopy'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { formatShare } from './geometry'

export type Tone = LineStatusView['tone']

const TONE_COLOR: Record<Tone, string> = {
  ok: 'var(--color-brand-green)',
  warn: 'var(--color-brand-amber)',
  bad: 'var(--color-brand-red-text)',
  pri: 'var(--color-brand-primary-ink)',
  mut: 'var(--color-brand-text-muted)',
}

const STATUS_ICON: Record<string, LucideIcon> = {
  check: CircleCheck,
  'triangle-alert': TriangleAlert,
  'circle-alert': CircleAlert,
  'circle-help': CircleHelp,
  'circle-dashed': CircleDashed,
  'refresh-cw': RefreshCw,
  'calendar-clock': CalendarClock,
  gauge: Gauge,
  lock: Lock,
}

/** The body's outer padding, matching the block header above it. */
export function BodyFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-3 pb-3.5', className)}>{children}</div>
}

/** The flat card every block body sits on. */
export function FlatCard({ children, className, divide }: { children: ReactNode; className?: string; divide?: boolean }) {
  return (
    <Card padding="none" divide={divide} className={className}>
      {children}
    </Card>
  )
}

/** Icon plus single-line text. Never colour alone. */
export function StatusLine({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone
  icon: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium', className)} style={{ color: TONE_COLOR[tone] }}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function lineStatusIcon(key: string): LucideIcon {
  return STATUS_ICON[key] ?? CircleCheck
}

/** Localized text for a line status, with money pre-formatted in the plan's base currency. */
export function useLineStatusText(view: PlanView) {
  const t = useBudgetBlocksCopy()
  return (s: LineStatusView): string => {
    const money = (n: number | undefined) => (n == null ? undefined : formatCurrency(Math.abs(n), view.base, false))
    const p: StatusTextParams = {
      percent: s.params.percent,
      daysLeft: s.params.daysLeft,
      months: s.params.months,
      delta: money(s.params.delta),
      overBy: money(s.params.overBy),
      average: money(s.params.average),
    }
    return t.status[s.kind](p)
  }
}

export function ActionButton({
  action,
  variant,
  label,
  onClick,
  className,
}: {
  action: LineAction
  variant: LineStatusView['button']['variant']
  label?: string
  onClick: () => void
  className?: string
}) {
  const t = useBudgetBlocksCopy()
  return (
    <Button size="touch" variant={variant} onClick={onClick} className={className}>
      {label ?? t.actions[action]}
    </Button>
  )
}

/** The ghost call to action at the foot of a block: "Add a bill". */
export function AddRow({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <Button
      variant="ghost"
      size="touch"
      onClick={onClick}
      className={cn('w-full rounded-none text-[var(--color-brand-primary-ink)]', className)}
    >
      <Plus aria-hidden />
      {label}
    </Button>
  )
}

/** Thin progress bar with an optional marker tick. */
export function ThinBar({
  fill,
  tick,
  color,
  className,
}: {
  fill: number
  tick?: number | null
  color: string
  className?: string
}) {
  return (
    <div className={cn('relative h-1.5 rounded-full bg-[var(--color-brand-elevated)]', className)} aria-hidden>
      <div className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${fill}%`, background: color }} />
      {tick != null ? (
        <span
          className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-sm bg-[var(--color-brand-text-primary)] opacity-55"
          style={{ insetInlineStart: `${tick}%` }}
        />
      ) : null}
    </div>
  )
}

/** One tappable plan line: tile, name, a sub line (status or hint), amount, share of income. */
export function LineRow({
  view,
  lv,
  mode,
  sub,
  onOpen,
  onAction,
  forceStatus,
}: {
  view: PlanView
  lv: LineView
  mode: 'plan' | 'month'
  /** Plain sub line used when the status does not replace it. */
  sub?: string
  onOpen: () => void
  onAction?: (action: LineAction) => void
  /** Show the status line even when it is `ok`. */
  forceStatus?: boolean
}) {
  const statusText = useLineStatusText(view)
  const copy = useBudgetBlocksCopy()
  const { status } = lv
  const showStatus = forceStatus === true || status.kind !== 'ok'
  const Icon = lineStatusIcon(status.icon)
  const hasAction = showStatus && status.button.action !== 'none' && onAction
  const subText = [sub, lv.line.confidence === 'estimated' && mode === 'plan' ? copy.estimate : null].filter(Boolean).join(' · ')
  return (
    <div>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-3.5 py-2 text-start">
        <TintedTile cat={BLOCK_META[lv.block].cat} size={36}>
          <LineIcon name={lineIconKey(lv.line.icon)} />
        </TintedTile>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{lv.line.name}</span>
          {showStatus ? (
            <StatusLine tone={status.tone} icon={Icon}>{statusText(status)}</StatusLine>
          ) : subText ? (
            <span className="truncate text-xs text-[var(--color-brand-text-secondary)]">{subText}</span>
          ) : null}
        </span>
        <span className="flex flex-col items-end">
          <span className="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
            {formatCurrency(lv.amount, view.base, false)}
          </span>
          {mode === 'plan' ? (
            <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{formatShare(lv.percent)}</span>
          ) : null}
        </span>
      </button>
      {hasAction ? (
        <div className="flex justify-end px-3.5 pb-2">
          <ActionButton action={status.button.action} variant={status.button.variant} onClick={() => onAction(status.button.action)} />
        </div>
      ) : null}
    </div>
  )
}
