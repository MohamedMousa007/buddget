'use client'

import { Check, ChevronLeft, Info, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { BLOCK_META, BUDGET_BLOCKS } from '@/lib/budget/blocks'
import { everydayPace, overBudgetLines, type PaceState } from '@/lib/budget/monthSummary'
import { monthRow } from '@/lib/budget/ledger'
import type { PlanView } from '@/lib/budget/planView.types'
import { useLocale } from '@/lib/i18n'
import type { BudgetSegmentCopy } from '@/lib/i18n/budgetPage/segmentCopy'
import type { BudgetBlock } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { AddRow, FlatCard, LineRow } from './blocks/parts'
import { formatShare } from './blocks/geometry'
import { monthKeyLabel } from './chromeFormat'
import { LineIcon } from './LineIcon'
import { SegmentExtra } from './SegmentExtra'
import { SegmentRail, type SegmentMark } from './SegmentRail'
import { TintedTile } from './TintedTile'
import { useBudgetBlocksCopy } from './useBlocksCopy'
import { useBudgetBuilderCopy } from './useBuilderCopy'
import { useOverviewCopy } from './useOverviewCopy'
import { useSegmentCopy } from './useSegmentCopy'

export interface SegmentReview {
  /** This segment still needs the user's check. */
  flagged: boolean
  onLooksRight: () => void
}

export interface SegmentBuild {
  /** The user chose to leave this segment out. */
  skipped: boolean
  /** Name of the next unfinished segment, null when this is the last one. */
  nextName: string | null
  onSkip: () => void
  onUnskip: () => void
  onDone: () => void
}

export interface SegmentPageProps {
  view: PlanView
  block: BudgetBlock
  onBack: () => void
  onSelect: (block: BudgetBlock) => void
  onOpenLine: (id: string) => void
  onAdd: (block: BudgetBlock) => void
  marks?: (block: BudgetBlock) => SegmentMark | undefined
  review?: SegmentReview
  build?: SegmentBuild
  /** A past plan: nothing can be opened, added or changed. */
  readOnly?: boolean
}

interface Stat { label: string; value: string }

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

/** Three facts per segment and view. Everyday in month view leads with pace; the rest with what that segment is about. */
export function segmentStats(view: PlanView, block: BudgetBlock, t: BudgetSegmentCopy, month: (key: string) => string, money: (n: number) => string, today: number): Stat[] {
  const b = view.blocks[block]
  const s = t.stat
  const tracking = view.mode === 'month'
  const none = s.none
  const generic = (): Stat[] =>
    tracking
      ? [{ label: s.spent, value: money(b.spent) }, { label: s.left, value: money(Math.max(0, b.total - b.spent)) }, { label: s.lines, value: String(b.lines.length) }]
      : [{ label: s.planned, value: money(b.total) }, { label: s.share, value: formatShare(b.percent) }, { label: s.lines, value: String(b.lines.length) }]

  if (block === 'everyday' && tracking) {
    const p = everydayPace(view)
    if (p) return [{ label: s.spent, value: money(p.spent) }, { label: s.perDay, value: money(p.perDay) }, { label: s.vsPace, value: `${p.aheadBy >= 0 ? '+' : '-'}${money(Math.abs(p.aheadBy))}` }]
  }
  if (block === 'bills' && tracking) {
    const r = monthRow(view, 'bills', today).status
    const next = r.kind === 'progress' && r.nextDay != null ? String(r.nextDay) : none
    const total = b.lines.filter((l) => l.amount > 0).length
    const done = b.lines.filter((l) => l.amount > 0 && l.paid).length
    return [{ label: s.paid, value: `${done} / ${total}` }, { label: s.nextDue, value: next }, { label: s.left, value: money(Math.max(0, b.total - b.spent)) }]
  }
  if (block === 'subscriptions') return [{ label: s.perMonthSubs, value: money(b.total) }, { label: s.charged, value: money(b.spent) }, { label: s.yearly, value: money(view.extras.subscriptions.yearlySetAside) }]
  if (block === 'debts') {
    const debts = view.extras.debts
    return [
      { label: s.totalOwed, value: money(sum(debts.map((d) => d.balance))) },
      { label: s.debtFree, value: view.extras.debtFreeMonth ? month(view.extras.debtFreeMonth) : none },
      { label: s.minimums, value: money(sum(debts.map((d) => d.minimum))) },
    ]
  }
  if (block === 'safety') {
    const e = view.extras.safety
    return [
      { label: s.monthsHeld, value: String(Math.round(e.monthsHeld * 10) / 10) },
      { label: s.target, value: String(e.targetMonths) },
      { label: s.reachedBy, value: e.reachedMonth ? month(e.reachedMonth) : none },
    ]
  }
  if (block === 'goals') {
    const g = view.extras.goals
    return [
      { label: s.saved, value: money(sum(g.map((x) => x.current))) },
      { label: s.targets, value: money(sum(g.map((x) => x.target ?? 0))) },
      { label: s.perMonth, value: money(sum(g.map((x) => x.monthly))) },
    ]
  }
  return generic()
}

const PACE_FILL: Record<PaceState, string> = { ok: 'var(--color-brand-primary-bright)', ahead: 'var(--color-brand-amber)', over: 'var(--color-brand-red)' }

/** The segment page: text back link, position, the rail as the only navigation, one hero card, the lines, one extra card. */
export function SegmentPage({ view, block, onBack, onSelect, onOpenLine, onAdd, marks, review, build, readOnly = false }: SegmentPageProps) {
  const t = useSegmentCopy()
  const hero = useOverviewCopy().hero
  const blocks = useBudgetBlocksCopy()
  const b = useBudgetBuilderCopy()
  const catLabel = useCategoryLabel()
  const { locale } = useLocale()
  const meta = BLOCK_META[block]
  const bv = view.blocks[block]
  const month = view.mode === 'month'
  const money = (n: number) => formatCurrency(n, view.base, false)
  const today = new Date().getDate()
  const index = BUDGET_BLOCKS.indexOf(block)
  const name = blocks.blockName[block]
  const pace = block === 'everyday' && month ? everydayPace(view) : null
  const over = block === 'everyday' && month ? overBudgetLines(view).sort((x, y) => y.spent - y.amount - (x.spent - x.amount))[0] : undefined
  const left = bv.total - bv.spent
  const stats = segmentStats(view, block, t, (k) => monthKeyLabel(k, locale), money, today)
  const empty = bv.lines.length === 0
  const showEstimate = review != null
  const Icon = pace?.state === 'ok' ? Check : TriangleAlert

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="link" size="touch" onClick={onBack} className="-ms-2 gap-1">
          <ChevronLeft className="rtl:rotate-180" aria-hidden />
          {t.back}
        </Button>
        <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-secondary)]">{b.position(index + 1, BUDGET_BLOCKS.length)}</span>
      </div>

      <SegmentRail current={index} onSelect={(i) => onSelect(BUDGET_BLOCKS[i])} marks={marks} caption={false} />

      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <TintedTile cat={meta.cat} size="lg">
            <LineIcon name={meta.icon} />
          </TintedTile>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-tight text-[var(--color-brand-text-primary)]">{name}</h1>
            {pace ? <p className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{t.hero.perDayToSpend(money(pace.perDay))}</p> : null}
          </div>
          {pace ? (
            <Badge tone={pace.state === 'ok' ? 'positive' : pace.state === 'ahead' ? 'warn' : 'negative'} size="md">
              <Icon aria-hidden />
              {hero.pace[pace.state]}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-[var(--color-brand-text-secondary)]">{month ? t.hero.left : t.hero.planned}</span>
            <span className="font-mono-numbers whitespace-nowrap text-[32px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
              {money(month ? Math.max(0, left) : bv.total)}
            </span>
          </div>
          <span className="font-mono-numbers pb-1 text-end text-xs text-[var(--color-brand-text-secondary)]">
            {month ? t.hero.ofPlanned(money(bv.total)) : t.hero.share(formatShare(bv.percent))}
          </span>
        </div>
        {pace ? (
          <div role="img" aria-label={hero.paceLabel} className="relative h-2.5 rounded-full bg-[var(--color-brand-elevated)]">
            <div className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${Math.min(100, (pace.spent / pace.planned) * 100)}%`, background: PACE_FILL[pace.state] }} />
            <span className="absolute -bottom-1 -top-1 w-0.5 rounded-sm bg-[var(--color-brand-text-primary)] opacity-70" style={{ insetInlineStart: `${Math.min(100, (view.dayOfCycle / Math.max(1, view.daysInCycle)) * 100)}%` }} aria-hidden />
          </div>
        ) : null}
        {over ? (
          <p className="flex items-start gap-2 rounded-xl bg-[var(--color-brand-elevated)] p-3 text-sm text-[var(--color-brand-text-secondary)]">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.buddgy.everydayOver(catLabel(over.line.name), money(over.spent - over.amount))}
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-[var(--color-brand-text-secondary)]">{s.label}</span>
              <span className="font-mono-numbers truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{s.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {review?.flagged ? (
        <p className="flex items-start gap-2 text-sm text-[var(--color-brand-amber)]" role="note">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.review.estimatedNote}
        </p>
      ) : null}

      <FlatCard divide>
        <ul className="divide-y divide-[var(--color-brand-border)]">
          {bv.lines.map((lv) => {
            const status = month && lv.amount > 0 ? (lv.spent > lv.amount ? t.line.over(money(lv.spent - lv.amount)) : t.line.left(money(lv.amount - lv.spent))) : undefined
            return (
              <li key={lv.line.id}>
                <LineRow
                  view={view}
                  lv={lv}
                  mode={view.mode}
                  sub={status ?? (block === 'bills' && lv.dueDay != null ? t.line.dueOn(lv.dueDay) : undefined)}
                  figure={month ? { amount: money(lv.spent), sub: t.line.ofCap(money(lv.amount)) } : undefined}
                  showEstimate={showEstimate}
                  onOpen={() => { if (!readOnly) onOpenLine(lv.line.id) }}
                />
              </li>
            )
          })}
        </ul>
        {empty && build ? <p className="px-3.5 py-3 text-sm text-[var(--color-brand-text-secondary)]">{build.skipped ? t.build.skipped : t.build.emptyRow}</p> : null}
        {empty && !build ? <p className="px-3.5 py-3 text-sm text-[var(--color-brand-text-secondary)]">{t.empty}</p> : null}
        {readOnly ? null : <AddRow label={t.add(name)} onClick={() => onAdd(block)} />}
      </FlatCard>

      <SegmentExtra view={view} block={block} />

      {build && empty ? (
        <Button variant="ghost" size="touch" className="self-center" onClick={build.skipped ? build.onUnskip : build.onSkip}>
          {build.skipped ? t.build.undoSkip : t.build.skip}
        </Button>
      ) : null}

      {review?.flagged || build ? (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-10 -mx-4 bg-[var(--color-brand-bg)] px-4 pb-3 pt-2 lg:bottom-4 lg:pe-24">
          {review?.flagged ? (
            <Button size="cta-block" onClick={review.onLooksRight}>
              {t.review.looksRight}
            </Button>
          ) : build ? (
            <Button size="cta-block" onClick={build.onDone}>
              {build.nextName ? t.build.doneNext(build.nextName) : t.build.finish}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
