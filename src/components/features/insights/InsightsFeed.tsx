'use client'

import { useMemo } from 'react'
import {
  Banknote, CalendarClock, CalendarDays, CreditCard, LineChart, PieChart, PiggyBank, Receipt, Repeat, Scale, ShoppingBag, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { track } from '@/lib/analytics/events'
import type { Insight, InsightKind } from '@/lib/insights/types'
import { lockedFindings } from '@/lib/insights/analysis'
import { formatCurrency } from '@/lib/utils/formatters'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Currency } from '@/lib/store/types'
import type { LockedFinding } from './LockedFindingSheet'
import { InsightCard } from './InsightCard'
import type { Tone } from './InsightsParts'

/** Params that are money: formatted by the page (and masked when the user asked) before a template sees them. */
const MONEY_PARAMS = new Set(['delta', 'amount', 'remaining', 'monthly', 'total', 'kept', 'typical', 'threshold', 'rise', 'avg', 'projected', 'low', 'high'])
const formatParams = (p: Record<string, number | string>, money: (n: number) => string) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, MONEY_PARAMS.has(k) && typeof v === 'number' ? money(v) : v]))

/** Each finding's glyph and tone: amber to watch, teal for facts, green for good news. */
const LOOK: Record<InsightKind, { Icon: typeof TrendingUp; tone: Tone }> = {
  pace: { Icon: TrendingUp, tone: 'amber' },
  topCategory: { Icon: PieChart, tone: 'amber' },
  kept: { Icon: PiggyBank, tone: 'green' },
  bnplBurden: { Icon: CalendarClock, tone: 'amber' },
  subsTotal: { Icon: Repeat, tone: 'teal' },
  billsBeforePayday: { Icon: CalendarDays, tone: 'teal' },
  payMix: { Icon: CreditCard, tone: 'teal' },
  categoryShift: { Icon: TrendingUp, tone: 'amber' },
  paydayRhythm: { Icon: Wallet, tone: 'amber' },
  weekdayPattern: { Icon: CalendarDays, tone: 'amber' },
  unusualPurchase: { Icon: ShoppingBag, tone: 'amber' },
  smallBuys: { Icon: Receipt, tone: 'teal' },
  cashVsCard: { Icon: Banknote, tone: 'teal' },
  priceRise: { Icon: Scale, tone: 'amber' },
  netWorthPath: { Icon: LineChart, tone: 'green' },
}

const lookOf = (f: Insight) => {
  const good = (f.kind === 'categoryShift' || f.kind === 'pace') && Number(f.params.up ?? f.params.more) === 0
  if (good) return { Icon: TrendingDown, tone: 'green' as const }
  if (f.kind === 'kept' && Number(f.params.positive) === 0) return { Icon: PiggyBank, tone: 'amber' as const }
  return LOOK[f.kind]
}

interface Props {
  insights: Insight[]
  currency: Currency
  /** Pro (or billing off): every finding in full. */
  advanced: boolean
  /** Opens the locked sheet for a finding, or for Pro in general. */
  onLocked: (finding: LockedFinding) => void
}

/** "What changed": the ranked findings as one list. Free keeps the sentence of Pro findings with the figures hidden. */
export function InsightsFeed({ insights, currency, advanced, onLocked }: Props) {
  const t = useT()
  const c = t.insights
  const lt = useInsightsLtCopy().changed
  const maskBuddgy = useMask('buddgy')
  const maskLists = useMask('lists')
  const money = useMemo(() => (n: number) => (maskLists ? MASK : formatCurrency(n, currency, false)), [currency, maskLists])
  // What Buddgy is sent follows the privacy setting: with Buddgy masked, no figure leaves the page.
  const seedMoney = useMemo(() => (n: number) => (maskBuddgy ? MASK : formatCurrency(n, currency, false)), [maskBuddgy, currency])
  const locked = lockedFindings(insights, advanced)

  return (
    <div className="space-y-3">
      <Card padding="none" divide render={<ul />} className="overflow-hidden">
        {insights.map((f) => {
          const p =
            f.kind === 'topCategory' || f.kind === 'categoryShift'
              ? { ...f.params, name: categoryLabel(t, String(f.params.name)) }
              : f.kind === 'unusualPurchase'
                ? { ...f.params, category: categoryLabel(t, String(f.params.category)) }
                : f.params
          const copy = c.kinds[f.kind]
          const shown = formatParams(p, money)
          const sent = formatParams(p, seedMoney)
          const { Icon, tone } = lookOf(f)
          return (
            <InsightCard
              key={f.kind}
              id={f.kind}
              icon={<Icon />}
              tone={tone}
              headline={copy.headline(shown)}
              why={copy.why(shown)}
              locked={!advanced && f.pro === true}
              askLabel={c.askBuddgy}
              onAsk={() => {
                track('insights.finding_ask', { kind: f.kind })
                useSettingsStore.getState().openAiChatWithSeed(copy.seed(sent), true)
              }}
              onUnlock={() => {
                track('insights.locked_tap', { kind: f.kind })
                onLocked({ tag: copy.tag, headline: copy.headline(shown).replace(/\*[^*]*\*/g, '••••') })
              }}
            />
          )
        })}
      </Card>
      {locked.length > 0 && (
        <Card padding="md" className="border-[color-mix(in_oklab,var(--color-brand-gold)_35%,var(--color-brand-border))] bg-[color-mix(in_oklab,var(--color-brand-gold)_8%,var(--color-brand-card))]">
          <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.moreWaiting(locked.length)}</p>
          <p className="mt-0.5 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{lt.moreBody}</p>
          <Button size="cta-block" className="mt-3" onClick={() => onLocked({})}>
            {c.seePro}
          </Button>
        </Card>
      )}
    </div>
  )
}
