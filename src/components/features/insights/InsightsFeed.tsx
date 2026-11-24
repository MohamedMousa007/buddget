'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { navigate } from '@/lib/navigation/navigate'
import { track } from '@/lib/analytics/events'
import { LockedFindingSheet } from './LockedFindingSheet'
import type { Insight } from '@/lib/insights/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Currency } from '@/lib/store/types'
import { InsightCard } from './InsightCard'

/** Params that are money: formatted by the page (and masked when the user asked) before a template sees them. */
const MONEY_PARAMS = new Set(['delta', 'amount', 'remaining', 'monthly', 'total', 'kept', 'typical', 'threshold', 'rise', 'avg', 'projected', 'low', 'high'])
const formatParams = (p: Record<string, number | string>, money: (n: number) => string) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, MONEY_PARAMS.has(k) && typeof v === 'number' ? money(v) : v]))

interface Props {
  insights: Insight[]
  currency: Currency
  /** Pro (or billing off): every finding in full. */
  advanced: boolean
}

/** The ranked findings. Free sees the top few in full; the rest keep their sentence with the figures hidden. */
export function InsightsFeed({ insights, currency, advanced }: Props) {
  const t = useT()
  const c = t.insights
  const maskBuddgy = useMask('buddgy')
  const maskLists = useMask('lists')
  const money = useMemo(() => (n: number) => (maskLists ? MASK : formatCurrency(n, currency, false)), [currency, maskLists])
  // What Buddgy is sent follows the privacy setting: with Buddgy masked, no figure leaves the page.
  const seedMoney = useMemo(() => (n: number) => (maskBuddgy ? MASK : formatCurrency(n, currency, false)), [maskBuddgy, currency])
  const [sheet, setSheet] = useState<{ tag: string; headline: string } | null>(null)
  const openUpgrade = () => {
    track('insights.paywall_open', { source: 'finding' })
    setSheet(null)
    navigate('/settings/pro')
  }
  const locked = insights.filter((f) => !advanced && f.pro === true)

  return (
    <div className="space-y-2.5">
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
        const isLocked = !advanced && f.pro === true
        return (
          <InsightCard
            key={f.kind}
            id={f.kind}
            area={f.area}
            tag={copy.tag}
            headline={copy.headline(shown)}
            why={copy.why(shown)}
            locked={isLocked}
            askLabel={c.askBuddgy}
            unlockLabel={c.unlock}
            onAsk={() => {
              track('insights.finding_ask', { kind: f.kind })
              useSettingsStore.getState().openAiChatWithSeed(copy.seed(sent), true)
            }}
            onUnlock={() => {
              track('insights.locked_tap', { kind: f.kind })
              setSheet({ tag: copy.tag, headline: copy.headline(shown).replace(/\*[^*]*\*/g, '••••') })
            }}
          />
        )
      })}
      <LockedFindingSheet finding={sheet} onSeePro={openUpgrade} onClose={() => setSheet(null)} />
      {locked.length > 0 && (
        <Card padding="md" variant="brand" className="space-y-1">
          <p className="text-sm font-bold text-[var(--color-brand-text-primary)]">{c.moreWaiting(locked.length)}</p>
          <p className="text-[0.78125rem] text-[var(--color-brand-text-secondary)]">{c.moreBody}</p>
          <Button size="touch" className="mt-2 w-full" onClick={openUpgrade}>
            {c.seePro}
          </Button>
        </Card>
      )}
    </div>
  )
}
