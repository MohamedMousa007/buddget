'use client'

import { ChevronLeft } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { StatusBarCover } from '@/components/layout/StatusBarCover'
import { format } from 'date-fns'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useT } from '@/lib/i18n'
import { navigate } from '@/lib/navigation/navigate'
import { money0, money2 } from '@/lib/subscriptions/subscriptionFormat'
import type { HeroNumbers } from '@/lib/subscriptions/subscriptionForecast'
import { cn } from '@/lib/utils'

const WRAP = 'mx-auto w-full max-w-[1100px] px-4'

/**
 * The teal hero band: a 48px header row, then exactly 191px of numbers. The height is fixed
 * and identical while loading, empty and populated, so nothing below it jumps.
 */
export function SubscriptionsHero({
  hero,
  base,
  loading,
}: {
  hero: HeroNumbers | null
  base: string
  loading: boolean
}) {
  const t = useT()
  const ui = t.subscriptions.ui.hero
  const { shortDate: formatDateShort } = useSubscriptionDates()
  const blank = loading || !hero
  const empty = !loading && hero !== null && hero.monthlyEquivalent === 0 && hero.due30 === 0
  const total = hero ? hero.paid + hero.left : 0
  const pct = total > 0 && hero ? Math.min(100, (hero.paid / total) * 100) : 0

  const cells = [
    { label: ui.monthlyEquivalent, value: blank || empty ? '—' : money0(hero.monthlyEquivalent), note: '' },
    { label: ui.perYear, value: blank || empty ? '—' : money0(hero.perYear), note: '' },
    {
      label: ui.nextCharge,
      value: blank || !hero.next ? '—' : hero.next.sub.name,
      note: blank || !hero.next ? '' : formatDateShort(format(hero.next.due, 'yyyy-MM-dd')),
    },
  ]

  return (
    <section className="bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">
      <StatusBarCover background="var(--color-brand-primary)" />
      <div className="pt-[env(safe-area-inset-top,0px)] lg:pt-0">
        <div className={WRAP}>
          <div className="flex h-12 items-center gap-2 text-base font-semibold">
            <IconButton
              variant="ghost"
              aria-label={t.common.back}
              onClick={() => navigate('/budget-setup')}
              className="-ms-3 text-[var(--color-brand-on-primary)] hover:bg-white/15 hover:text-[var(--color-brand-on-primary)]"
            >
              <ChevronLeft className="rtl:rotate-180" strokeWidth={1.75} />
            </IconButton>
            <h1>{t.subscriptions.pageTitle}</h1>
          </div>
        </div>
        <div className={cn(WRAP, 'box-border flex h-[191px] flex-col pt-3')}>
          <div className="flex h-[22px] items-center text-xs font-semibold">{ui.label}</div>
          <div className="flex h-[34.5px] items-baseline gap-2">
            <span className="text-sm font-semibold">{base}</span>
            <span className="font-mono-numbers text-[30px] font-semibold leading-[34px] tracking-[-0.02em]">
              {blank ? '—' : money2(hero.due30)}
            </span>
          </div>
          <div className="flex h-[38.75px] flex-col justify-center gap-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-on-primary)]/30">
              <div
                className="h-full rounded-full bg-[var(--color-brand-on-primary)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span>{ui.paid(blank ? '0' : money0(hero.paid))}</span>
              <span>{ui.left(blank ? '0' : money0(hero.left))}</span>
            </div>
          </div>
          <div className="mt-auto grid h-[66px] grid-cols-[1fr_1fr_1.3fr] border-t border-[var(--color-brand-on-primary)]/30">
            {cells.map((c) => (
              <div key={c.label} className="flex min-w-0 flex-col justify-center gap-0.5 pe-2">
                <span className="text-[11px] font-semibold">{c.label}</span>
                <span className="truncate whitespace-nowrap font-mono-numbers text-sm font-semibold">{c.value}</span>
                <span className="font-mono-numbers text-[11px] font-medium">{c.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
