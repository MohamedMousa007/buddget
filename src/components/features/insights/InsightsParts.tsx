'use client'

import type { ReactNode } from 'react'
import { ChevronRight, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { formatChangePct } from '@/lib/utils/changePct'

/** The tinted icon tiles the findings and examples use: amber for "watch this", teal for facts, green for good news. */
export const TONES = {
  amber: { bg: 'var(--color-brand-amber-soft)', fg: 'var(--color-brand-amber)' },
  teal: { bg: 'var(--color-brand-primary-soft)', fg: 'var(--color-brand-primary-ink)' },
  green: { bg: 'var(--color-brand-green-soft)', fg: 'var(--color-brand-green)' },
} as const
export type Tone = keyof typeof TONES

export function ToneTile({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-[11px] [&_svg]:size-5', className)} style={{ background: TONES[tone].bg, color: TONES[tone].fg }}>
      {children}
    </span>
  )
}

/** One Insights section: a card with a 15px bold title and an optional right-hand figure or control. */
export function InsightsSection({ title, right, children, className, id }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <Card padding="md" className={className} render={<section aria-labelledby={id} />}>
      <div className="flex items-start justify-between gap-3">
        <h3 id={id} className="flex items-center gap-2 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{title}</h3>
        {right}
      </div>
      {children}
    </Card>
  )
}

export function ProTag() {
  return (
    <Badge tone="gilt" size="xs">
      {useInsightsLtCopy().proTag}
    </Badge>
  )
}

/** "Unlock with Pro ›" in gold: the one way into the locked sheet from a hidden figure. */
export function UnlockButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button variant="ghost" size="touch" className={cn('-ms-2 gap-1 px-2 text-[0.8125rem] font-semibold text-[var(--color-brand-gold)]', className)} onClick={onClick}>
      <Sparkles aria-hidden className="size-4" />
      {useT().insights.unlock}
      <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
    </Button>
  )
}

/**
 * A Pro section a Free member sees: its title with a Pro tag, a blurred placeholder (never real figures), what it
 * would show, and the unlock button.
 */
export function LockedSection({ title, what, teaser, onUnlock }: { title: ReactNode; what: string; teaser: ReactNode; onUnlock: () => void }) {
  return (
    <InsightsSection title={<>{title} <ProTag /></>}>
      <div className="relative mt-3">
        <div aria-hidden className="pointer-events-none flex min-h-28 select-none flex-col justify-center opacity-40 blur-[3px]">{teaser}</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="max-w-[220px] text-[0.8125rem] font-medium text-[var(--color-brand-text-primary)]">{what}</p>
          <UnlockButton onClick={onUnlock} className="ms-0" />
        </div>
      </div>
    </InsightsSection>
  )
}

/** Change against the same days of last month: amber when up, green when down, "same" at zero. */
export function DeltaChip({ pct }: { pct: number | null }) {
  const c = useInsightsLtCopy().where
  if (pct === null) return null
  if (pct === 0) return <span className="text-xs text-[var(--color-brand-text-muted)]">{c.same}</span>
  const up = pct > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 font-mono-numbers text-xs font-semibold', up ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-green)]')}
      aria-label={up ? c.up(pct) : c.down(-pct)}
    >
      <Icon aria-hidden className="size-3.5" />
      {formatChangePct(pct)}
    </span>
  )
}

/** `*like this*` marks the figures in a sentence; with `locked` they become •••• pills. */
export function Emphasis({ text, locked = false }: { text: string; locked?: boolean }) {
  return (
    <>
      {text.split('*').map((part, i) =>
        i % 2 === 0 ? (
          part
        ) : locked ? (
          <span key={i} aria-hidden className="mx-0.5 inline-block select-none rounded-md bg-[var(--color-brand-sunken)] px-1.5 align-middle font-mono-numbers text-[0.75rem] leading-5 text-transparent">
            ••••
          </span>
        ) : (
          <b key={i} className="font-semibold text-[var(--color-brand-text-primary)]">
            {part}
          </b>
        ),
      )}
    </>
  )
}
