'use client'

import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AppLink } from '@/components/ui/AppLink'
import { useT } from '@/lib/i18n'

export type AreaKey = 'spending' | 'income' | 'budget' | 'bills' | 'debts' | 'wealth' | 'goals' | 'how'

const AREAS: { key: AreaKey; href: string; color: string }[] = [
  { key: 'spending', href: '/flow', color: 'var(--color-cat-1)' },
  { key: 'income', href: '/paydays', color: 'var(--color-brand-green)' },
  { key: 'budget', href: '/budget-setup', color: 'var(--color-cat-5)' },
  { key: 'bills', href: '/subscriptions', color: 'var(--color-cat-2)' },
  { key: 'debts', href: '/debts', color: 'var(--color-cat-4)' },
  { key: 'wealth', href: '/wealth', color: 'var(--color-brand-gold)' },
  { key: 'goals', href: '/goals', color: 'var(--color-cat-6)' },
  { key: 'how', href: '/accounts', color: 'var(--color-brand-text-secondary)' },
]

/** One row per part of the app, each opening that part. Reuses the app's routes; nothing is recomputed here. */
export function InsightsAreas() {
  const t = useT()
  return (
    <Card padding="none" divide render={<ul />}>
      {AREAS.map(({ key, href, color }) => (
        <li key={key}>
          <AppLink href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-[var(--color-brand-elevated)]">
            <span
              aria-hidden
              className="size-9 shrink-0 rounded-xl"
              style={{ background: `color-mix(in oklab, ${color} 15%, var(--color-brand-card))` }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{t.insights.areas[key].title}</span>
              <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{t.insights.areas[key].sub}</span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
          </AppLink>
        </li>
      ))}
    </Card>
  )
}
