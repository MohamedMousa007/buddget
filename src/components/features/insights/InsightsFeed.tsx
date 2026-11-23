'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { navigate } from '@/lib/navigation/navigate'
import { FREE_INSIGHTS } from '@/lib/insights/rank'
import type { Insight } from '@/lib/insights/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Currency } from '@/lib/store/types'
import { InsightCard } from './InsightCard'

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
  const openUpgrade = () => navigate('/settings/pro')
  const locked = insights.filter((_, i) => !advanced && i >= FREE_INSIGHTS)

  return (
    <div className="space-y-2.5">
      {insights.map((f, i) => {
        const p = f.kind === 'topCategory' ? { ...f.params, name: categoryLabel(t, String(f.params.name)) } : f.params
        const copy = c.kinds[f.kind]
        const isLocked = !advanced && i >= FREE_INSIGHTS
        return (
          <InsightCard
            key={f.kind}
            area={f.area}
            tag={copy.tag}
            headline={copy.headline(p, money)}
            why={copy.why(p, money)}
            locked={isLocked}
            askLabel={c.askBuddgy}
            unlockLabel={c.unlock}
            onAsk={() => useSettingsStore.getState().openAiChatWithSeed(copy.seed(p, seedMoney), true)}
            onUnlock={openUpgrade}
          />
        )
      })}
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
