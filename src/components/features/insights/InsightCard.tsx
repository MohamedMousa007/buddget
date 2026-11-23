'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import type { InsightArea } from '@/lib/insights/types'

const AREA_DOT: Record<InsightArea, string> = {
  spending: 'var(--color-cat-3)',
  income: 'var(--color-brand-green)',
  bills: 'var(--color-cat-2)',
  debts: 'var(--color-cat-4)',
  how: 'var(--color-cat-5)',
  wealth: 'var(--color-brand-gold)',
}

export interface InsightCardProps {
  /** The finding's kind, so Buddgy can scroll to it. */
  id: string
  area: InsightArea
  tag: string
  /** The sentence; `*like this*` marks the figures. */
  headline: string
  why: string
  /** Free users past the top findings: the sentence stays, the figures are hidden. */
  locked?: boolean
  askLabel: string
  unlockLabel: string
  onAsk: () => void
  onUnlock: () => void
}

function Headline({ text, locked }: { text: string; locked: boolean }) {
  return (
    <>
      {text.split('*').map((part, i) =>
        i % 2 === 0 ? (
          part
        ) : locked ? (
          <span key={i} aria-hidden className="mx-0.5 inline-block select-none rounded-md bg-[var(--color-brand-sunken)] px-1.5 text-transparent">
            ••••
          </span>
        ) : (
          <b key={i} className="font-bold text-[var(--color-brand-primary-ink)]">
            {part}
          </b>
        ),
      )}
    </>
  )
}

/** One finding. The locked variant is the same card with the figures hidden and "Unlock with Pro" in place of "Ask Buddgy". */
export function InsightCard({ id, area, tag, headline, why, locked = false, askLabel, unlockLabel, onAsk, onUnlock }: InsightCardProps) {
  return (
    <Card padding="md" className="space-y-1.5 scroll-mt-4" data-insight-id={id} data-insight-locked={locked || undefined}>
      <span className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-secondary)]">
        <i aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: AREA_DOT[area] }} />
        {tag}
      </span>
      <p className="text-base font-bold leading-snug text-[var(--color-brand-text-primary)]">
        <Headline text={headline} locked={locked} />
      </p>
      {!locked && <p className="text-[0.78125rem] leading-snug text-[var(--color-brand-text-secondary)]">{why}</p>}
      <div className="-mb-1.5 -ms-2 pt-1">
        {locked ? (
          <Button variant="ghost" size="touch" className="font-bold text-[var(--color-brand-gold)]" onClick={onUnlock}>
            {unlockLabel} ›
          </Button>
        ) : (
          <Button variant="ghost" size="touch" className="gap-1.5 font-bold text-[var(--color-brand-primary-ink)]" onClick={onAsk}>
            <BuddgyIcon size={20} mood="curious" />
            {askLabel}
          </Button>
        )}
      </div>
    </Card>
  )
}
