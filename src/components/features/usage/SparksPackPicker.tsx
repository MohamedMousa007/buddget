'use client'

import { bonusSparks } from '@/lib/billing/packBonus'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useUsageCopy, type UsageCopy } from '@/lib/i18n/usageCopy'

export interface SparksPack {
  id: string
  /** Sparks in the pack before any bonus. */
  sparks: number
  /** The store's price string, in the person's currency. */
  price: string
}

/** Quick answers cost about 0.3 credits, a receipt scan about 3.1, and a Pro week is 150. Computed from the cost table so the line stays honest. */
const QUICK_COST = 0.3
const SCAN_COST = 3.1
const PRO_WEEK = 150

export function packBlurb(sparks: number, copy: UsageCopy['packs']): string {
  if (sparks >= 900) return copy.weeks(Math.round(sparks / PRO_WEEK))
  const raw = sparks / QUICK_COST
  const quick = raw >= 1000 ? Math.floor(raw / 100) * 100 : Math.floor(raw / 10) * 10
  return sparks >= 150 && sparks < 900 ? copy.aboutScans(quick, Math.round(sparks / SCAN_COST)) : copy.aboutQuick(quick)
}

/** Pro gets a bonus on every pack (15%, 20% for loyal Pro), added by the server when the purchase arrives; the picker shows the real amount. */
export const withProBonus = (sparks: number, percent: number): number => sparks + bonusSparks(sparks, percent)

/** The pack shown selected first: the middle of the ladder. */
export const defaultPackId = (packs: readonly SparksPack[]): string | null => packs[Math.floor((packs.length - 1) / 2)]?.id ?? null

interface Props {
  packs: readonly SparksPack[]
  selected: string | null
  onSelect: (id: string) => void
  /** The member's pack bonus in percent (`rewards.packBonusPercent`); 0 shows the plain amount. */
  bonusPercent: number
  disabled?: boolean
}

/**
 * The Sparks packs as cards, not a free slider: each stop is its own store product. The middle pack is preselected, the largest sits
 * under "More". Every card says in plain words what the pack roughly buys.
 */
export function SparksPackPicker({ packs, selected, onSelect, bonusPercent, disabled }: Props) {
  const copy = useUsageCopy()
  const [more, setMore] = useState(false)
  const largest = packs.length > 4 ? packs[packs.length - 1]! : null
  const shown = largest && !more && selected !== largest.id ? packs.slice(0, -1) : packs
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={copy.packs.title} className="flex flex-col gap-2">
        {shown.map((p) => {
          const real = withProBonus(p.sparks, bonusPercent)
          return (
            <SelectableCard key={p.id} selected={selected === p.id} onClick={() => onSelect(p.id)} disabled={disabled} surface="card" className="min-h-[64px] p-3.5">
              <span dir="auto" className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">
                  <span dir="ltr" className="font-mono-numbers">{real}</span>
                  {bonusPercent > 0 ? <Badge tone="brand" size="sm">{copy.packs.withPro(p.sparks, bonusPercent)}</Badge> : null}
                </span>
                <span className="mt-0.5 block text-[0.78125rem] leading-snug text-[var(--color-brand-text-secondary)]">{packBlurb(real, copy.packs)}</span>
              </span>
              <span dir="ltr" className="font-mono-numbers shrink-0 text-end text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{p.price}</span>
            </SelectableCard>
          )
        })}
      </div>
      {largest && !more && selected !== largest.id ? (
        <Button size="touch" variant="ghost" onClick={() => setMore(true)} className="w-full font-semibold text-[var(--color-brand-text-secondary)]">{copy.packs.more}</Button>
      ) : null}
    </div>
  )
}
