'use client'

import { ChevronRight, Flag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BLOCK_META } from '@/lib/budget/blocks'
import { monthRow, planRow, type MonthRight, type MonthStatus } from '@/lib/budget/ledger'
import type { PlanView } from '@/lib/budget/planView.types'
import type { BudgetOverviewCopy } from '@/lib/i18n/budgetPage/overviewCopy'
import { useLocale } from '@/lib/i18n'
import type { BudgetBlock } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { monthKeyLabel, percentText } from './chromeFormat'
import { LineIcon } from './LineIcon'
import { TintedTile } from './TintedTile'
import { useBudgetBlocksCopy } from './useBlocksCopy'
import { useOverviewCopy } from './useOverviewCopy'

type Tone = 'ok' | 'warn' | 'bad' | 'mut'
const TONE: Record<Tone, string> = {
  ok: 'var(--color-brand-green)',
  warn: 'var(--color-brand-amber)',
  bad: 'var(--color-brand-red-text)',
  mut: 'var(--color-brand-text-secondary)',
}

export interface RowText {
  status: string
  tone: Tone
  /** Top right: the figure. */
  amount: string
  /** Under it: "of planned", "to move", a change from last month; empty when there is nothing to say. */
  sub: string
}

interface TextCtx {
  copy: BudgetOverviewCopy['ledger']
  hero: BudgetOverviewCopy['hero']
  money: (n: number) => string
  month: (key: string) => string
}

function monthStatusText(s: MonthStatus, x: TextCtx): { text: string; tone: Tone } {
  const { copy } = x
  switch (s.kind) {
    case 'empty': return { text: copy.empty, tone: 'mut' }
    case 'allPaid': return { text: copy.allPaid(s.count), tone: 'ok' }
    case 'progress': return { text: [copy.progress(s.done, s.total), s.nextDay != null ? copy.next(s.nextDay) : null].filter(Boolean).join(' · '), tone: 'mut' }
    case 'overLine': return { text: [copy.overLine(s.name, x.money(s.over)), s.ahead ? copy.ahead : null].filter(Boolean).join(' · '), tone: 'bad' }
    case 'pace': return { text: x.hero.pace[s.state], tone: s.state === 'ok' ? 'ok' : s.state === 'ahead' ? 'warn' : 'bad' }
    case 'moves': return { text: s.day != null ? copy.moves(s.day) : copy.movesThisMonth, tone: 'mut' }
    case 'moved': return { text: copy.moved, tone: 'ok' }
    case 'goals':
      return {
        text: [s.behind > 0 ? copy.behind(s.behind) : copy.onTrack, s.nextTarget ? x.month(s.nextTarget.slice(0, 7)) : null].filter(Boolean).join(' · '),
        tone: s.behind > 0 ? 'warn' : 'ok',
      }
  }
}

function monthRightText(r: MonthRight, x: TextCtx): { amount: string; sub: string } {
  const { copy } = x
  switch (r.kind) {
    case 'left': return { amount: `${x.money(r.amount)} ${copy.left}`, sub: copy.of(x.money(r.of)) }
    case 'over': return { amount: `${x.money(r.amount)} ${copy.over}`, sub: copy.of(x.money(r.of)) }
    case 'done': return { amount: copy.done, sub: copy.of(x.money(r.of)) }
    case 'toMove': return { amount: x.money(r.amount), sub: copy.toMove }
    case 'moved': return { amount: copy.moved, sub: '' }
    case 'none': return { amount: '', sub: '' }
  }
}

/** All the words of one ledger row, pure over the view so they can be tested without rendering. */
export function ledgerRowText(view: PlanView, block: BudgetBlock, today: number, copy: BudgetOverviewCopy, month: (key: string) => string, review = false): RowText {
  const x: TextCtx = { copy: copy.ledger, hero: copy.hero, money: (n) => formatCurrency(n, view.base, false), month }
  if (view.mode === 'month') {
    const r = monthRow(view, block, today)
    const s = monthStatusText(r.status, x)
    return { status: s.text, tone: s.tone, ...monthRightText(r.right, x) }
  }
  const r = planRow(view, block)
  const estimated = view.blocks[block].lines.filter((l) => l.line.confidence === 'estimated').length
  const what =
    block === 'safety' && r.held ? copy.ledger.held(String(Math.round(r.held.months * 10) / 10), r.held.target)
    : block === 'goals' || block === 'grow' ? (r.names.join(', ') || copy.ledger.count[block](r.count))
    : copy.ledger.count[block === 'safety' ? 'grow' : block](r.count)
  const parts = review && estimated > 0 ? [what, copy.ledger.estimated(estimated)] : [what, copy.ledger.share(percentText(r.share))]
  return {
    status: r.count === 0 && !r.held ? copy.ledger.empty : parts.join(' · '),
    tone: review && estimated > 0 ? 'warn' : 'mut',
    amount: x.money(r.planned),
    sub: r.change == null ? '' : r.change > 0 ? copy.ledger.changeUp(r.change) : copy.ledger.changeDown(-r.change),
  }
}

export interface LedgerRowProps {
  view: PlanView
  block: BudgetBlock
  /** Calendar day of month, for "next on the 20th". */
  today: number
  /** Review mode: estimates are flagged here and nowhere else. */
  review?: boolean
  /** Replaces the status line (building by hand: "Empty · tap to add", "Skipped"). */
  statusOverride?: string
  /** The shared review selector says this segment still needs a check; overrides the row's own guess. */
  flagged?: boolean
  /** A small badge after the name, e.g. "Start here". */
  tag?: string
  onOpen: () => void
}

/** One of the seven segment rows: tile, name, status in words, and the figure that matters. No bars, no dots. */
export function LedgerRow({ view, block, today, review = false, statusOverride, flagged: flaggedProp, tag, onOpen }: LedgerRowProps) {
  const copy = useOverviewCopy()
  const blocks = useBudgetBlocksCopy()
  const { locale } = useLocale()
  const meta = BLOCK_META[block]
  const t = ledgerRowText(view, block, today, copy, (k) => monthKeyLabel(k, locale), review)
  const flagged = flaggedProp ?? (review && t.tone === 'warn')
  return (
    <li>
      <button
        type="button"
        data-raw-button-ok="a full-width tappable ledger row, not a control with a shared shape"
        onClick={onOpen}
        aria-label={copy.ledger.open(blocks.blockName[block])}
        className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2 text-start"
      >
        <TintedTile cat={meta.cat} size={36}>
          <LineIcon name={meta.icon} />
        </TintedTile>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[0.9375rem] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{blocks.blockName[block]}</span>
            {tag ? <Badge tone="brand" size="sm" className="shrink-0">{tag}</Badge> : null}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs font-medium leading-snug" style={{ color: TONE[flaggedProp === undefined ? t.tone : flagged ? 'warn' : 'mut'] }}>
            {flagged ? <Flag className="size-3 shrink-0" aria-hidden /> : null}
            <span dir="auto" className="line-clamp-2">{statusOverride ?? t.status}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end text-end">
          {t.amount ? <span dir="auto" className="font-mono-numbers text-[0.9375rem] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{t.amount}</span> : null}
          {t.sub ? <span dir="auto" className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{t.sub}</span> : null}
        </span>
        <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
      </button>
    </li>
  )
}
