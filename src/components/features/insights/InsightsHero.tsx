'use client'

import type { ReactNode } from 'react'
import { AlertCircle, Check, Clock, Plus } from 'lucide-react'
import { BAND_FG2, BAND_MIX, FLOW_BAND_BG } from '@/components/features/hero/HeroBand'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { weekdayNames } from '@/lib/i18n/dateFormat'
import { useLocale } from '@/lib/i18n'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { formatWhole } from '@/lib/utils/formatters'
import type { HeroTile, HeroVerdict } from '@/lib/insights/analysis'
import { Emphasis } from './InsightsParts'

/** The band surface shared by the analysis hero and the learning hero: Flow's gradient, as a rounded card. */
export function InsightsBand({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl text-[var(--flow-band-fg)]" style={{ background: FLOW_BAND_BG }}>
      <div className="px-[18px] pb-4 pt-3">{children}</div>
    </section>
  )
}

export const BAND_LABEL = `text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${BAND_FG2}`

/** Flow's inverted status chip: band-coloured fill, the tone carried by the text. */
const CHIP = {
  ok: { Icon: Check, color: 'var(--flow-chip-ok)' },
  warn: { Icon: Clock, color: 'var(--flow-chip-warn)' },
  over: { Icon: AlertCircle, color: 'var(--flow-chip-over)' },
} as const

function StatusChip({ tone, label }: { tone: keyof typeof CHIP; label: string }) {
  const { Icon, color } = CHIP[tone]
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--flow-band-fg)] px-2 text-[0.71875rem] font-bold" style={{ color }}>
      <Icon aria-hidden className="size-[13px]" strokeWidth={2.5} />
      {label}
    </span>
  )
}

function Tile({ label, value, sub, locked }: { label: string; value: string | null; sub: string; locked: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl px-3.5 py-3" style={{ background: BAND_MIX }}>
      <p className={`truncate text-[0.6875rem] font-bold uppercase tracking-[0.06em] ${BAND_FG2}`}>{label}</p>
      <p className="mt-1 truncate font-mono-numbers text-[1.0625rem] font-semibold leading-tight">
        {locked ? <span aria-hidden className="inline-block w-10 rounded bg-[var(--flow-band-deep)] text-transparent">••••</span> : value}
      </p>
      <p className={`mt-0.5 text-[0.71875rem] leading-snug ${BAND_FG2}`}>{sub}</p>
    </div>
  )
}

interface Props {
  verdict: HeroVerdict
  tiles: HeroTile[]
  /** "October · day 19 of 31". */
  dayLabel: string
  month: string
  /** Free members with Pro tiles they cannot read. */
  lockedCount: number
  onSeePro: () => void
  onAddIncome: () => void
  /** No budget yet: the status slot becomes Flow's "Set budget" pill. */
  onSetBudget?: () => void
}

/** Flow's set-budget pill: a 44px tap box around the band's 26px pill. */
function SetBudgetPill({ onPress }: { onPress: () => void }) {
  const t = useT()
  return (
    <button
      data-raw-button-ok="a 44px tap box around the band's 26px pill; the inner span is the visible pill"
      type="button"
      onClick={onPress}
      className="group/pill -my-[11px] -me-2 flex h-11 shrink-0 items-center px-2 outline-none [touch-action:manipulation]"
    >
      <span className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full border border-[var(--flow-band-mix)] bg-[var(--flow-band-mix)] px-2.5 text-[0.75rem] font-medium text-[var(--flow-band-fg)] transition-colors group-hover/pill:bg-[color-mix(in_oklab,var(--flow-band-fg)_30%,transparent)] group-focus-visible/pill:ring-3 group-focus-visible/pill:ring-ring group-active/pill:translate-y-px">
        {t.flow.setBudget}
      </span>
    </button>
  )
}

/** The analysis hero: how the month ends at this pace, what a day lands it on budget, and the four findings behind it. */
export function InsightsHero({ verdict, tiles, dayLabel, month, lockedCount, onSeePro, onAddIncome, onSetBudget }: Props) {
  const t = useT()
  const c = useInsightsLtCopy().hero
  const { locale } = useLocale()
  const hidden = useMask('hero')
  const money = (n: number) => (hidden ? MASK : formatWhole(n))

  if (verdict.kind === 'noIncome') {
    return (
      <InsightsBand>
        <span className={BAND_LABEL}>{dayLabel}</span>
        <p className="mt-2 font-mono-numbers text-[32px] font-semibold leading-tight">—</p>
        <p className={`text-[0.8125rem] ${BAND_FG2}`}>{c.noIncomeBody(month)}</p>
        <Button size="touch" className="mt-3 rounded-full bg-[var(--flow-band-fg)] text-[0.875rem] font-semibold text-[var(--flow-band-b)] hover:bg-[var(--flow-band-fg)]" onClick={onAddIncome}>
          <Plus aria-hidden className="size-4" />
          {c.addIncome}
        </Button>
      </InsightsBand>
    )
  }

  const chip =
    verdict.kind === 'budget'
      ? verdict.status === 'over'
        ? { tone: 'over' as const, label: c.status.overBudget }
        : verdict.status === 'warning'
          ? { tone: 'warn' as const, label: c.status.overPace }
          : { tone: 'ok' as const, label: c.status.onTrack }
      : verdict.kind === 'usual'
        ? verdict.more
          ? { tone: 'warn' as const, label: c.status.aboveUsual }
          : { tone: 'ok' as const, label: c.status.belowUsual }
        : null

  const lead = verdict.kind === 'budget' ? c.finishLead(month) : verdict.kind === 'usual' ? c.usualLead : verdict.kind === 'projection' ? c.projectionLead(month) : c.earlyLead(month)
  const big =
    verdict.kind === 'budget' ? c.big(money(verdict.delta), verdict.over)
    : verdict.kind === 'usual' ? c.usualBig(money(verdict.delta), verdict.more)
    : verdict.kind === 'projection' ? money(verdict.projected)
    : money(verdict.spent)
  const side = verdict.kind === 'budget' ? c.ofBudget(money(verdict.budget)) : verdict.kind === 'usual' ? c.usualSide : null
  const line =
    verdict.kind === 'budget'
      ? verdict.daysLeft <= 0 || verdict.landDaily === null ? null : verdict.landDaily > 0 ? c.land(money(verdict.landDaily), money(verdict.dailyRate), verdict.over) : c.nothingLeft
      : verdict.kind === 'early' ? c.earlyNote(month, verdict.daysMore)
      : null

  const tileView = (tile: HeroTile) => {
    const p = tile.insight?.params ?? {}
    const n = (k: string) => Number(p[k] ?? 0)
    const label = c.tiles.label[tile.key]
    if (!tile.insight) return <Tile key={tile.key} label={label} value="—" sub={c.tiles.empty} locked={false} />
    const name = (k: string) => categoryLabel(t, String(p[k] ?? ''))
    switch (tile.insight.kind) {
      case 'categoryShift':
        return <Tile key={tile.key} label={label} value={c.tiles.shift(name('name'), n('pct'), n('up') === 1)} sub={c.tiles.shiftSub(n('pct'), n('up') === 1)} locked={tile.locked} />
      case 'topCategory':
        return <Tile key={tile.key} label={label} value={c.tiles.top(name('name'), n('share'))} sub={c.tiles.topSub} locked={tile.locked} />
      case 'billsBeforePayday':
        return <Tile key={tile.key} label={label} value={c.tiles.bills(money(n('total')))} sub={c.tiles.billsSub(n('count'), n('days'))} locked={tile.locked} />
      case 'unusualPurchase':
        return (
          <Tile
            key={tile.key}
            label={label}
            value={c.tiles.unusual(String(p.description ?? ''), money(n('amount')))}
            sub={tile.locked ? c.tiles.locked : c.tiles.unusualSub(n('typical') > 0 ? Math.round(n('amount') / n('typical')) : 0, name('category'))}
            locked={tile.locked}
          />
        )
      case 'weekdayPattern':
        return <Tile key={tile.key} label={label} value={weekdayNames(locale)[n('day')] ?? ''} sub={tile.locked ? c.tiles.locked : c.tiles.bigDaySub(money(n('avg')))} locked={tile.locked} />
      default:
        return null
    }
  }
  const showTiles = tiles.some((x) => x.insight !== null)

  return (
    <InsightsBand>
      <div className="flex items-center justify-between gap-2">
        <span className={`min-w-0 truncate ${BAND_LABEL}`}>{dayLabel}</span>
        {onSetBudget ? <SetBudgetPill onPress={onSetBudget} /> : chip ? <StatusChip tone={chip.tone} label={chip.label} /> : null}
      </div>
      <p className={`mt-2 text-[0.8125rem] ${BAND_FG2}`}>{lead}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span dir="auto" className="font-mono-numbers text-[32px] font-semibold leading-tight tracking-[-0.03em]">{big}</span>
        {side ? <span className={`text-[0.8125rem] ${BAND_FG2}`}>{side}</span> : null}
      </p>
      {line ? (
        <p className="mt-1 text-[0.8125rem] [&_b]:font-mono-numbers [&_b]:font-bold [&_b]:text-[var(--flow-band-fg)]">
          <Emphasis text={line} />
        </p>
      ) : null}
      {showTiles ? <div className="mt-3 grid grid-cols-2 gap-2">{tiles.map(tileView)}</div> : null}
      {lockedCount > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl ps-3.5" style={{ background: 'var(--flow-band-deep)' }}>
          <span className={`text-[0.75rem] ${BAND_FG2}`}>{c.lockedMore(lockedCount)}</span>
          <Button variant="ghost" size="touch" className="text-[0.8125rem] font-semibold text-[var(--flow-band-fg)] hover:bg-[var(--flow-band-mix)] hover:text-[var(--flow-band-fg)]" onClick={onSeePro}>
            {t.insights.seePro} ›
          </Button>
        </div>
      ) : null}
    </InsightsBand>
  )
}
