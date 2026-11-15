'use client'

import { useEffect } from 'react'
import { MembershipHero } from '@/components/features/membership/MembershipHero'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { AppLink as Link } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useLocale } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { navigate } from '@/lib/navigation/navigate'
import { cn } from '@/lib/utils'

/** The Sparks page: what is left, when it resets, what each action costs. SMS auto-tracking is free and says so. */
export default function SparksPage() {
  const c = useMembershipCopy()
  const sp = c.sparks
  const { locale } = useLocale()
  const me = useBillingStore((s) => s.me)
  const on = billingOn(me)

  useEffect(() => {
    if (me && !on) navigate('/settings', { replace: true })
  }, [me, on])

  if (!me || !on) return null
  const sparks = me.sparks
  const resets = sparks?.resetsAt ? new Date(sparks.resetsAt).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'long' }) : ''
  const empty = !!sparks && sparks.left <= 0
  const isFree = me.planKey === 'free'

  return (
    <SettingsSubPageShell title={sp.title} backHref="/settings/pro">
      <div className="space-y-5">
        <MembershipHero tone="pro" className="items-center text-center">
          <ProgressRing pct={sparks && sparks.total ? (sparks.left / sparks.total) * 100 : 0} size={148} stroke={10} arc="var(--member-mint)" track="var(--member-line)">
            <span className="flex flex-col items-center">
              <span dir="ltr" className="font-mono-numbers text-4xl font-semibold leading-none">{sparks ? sparks.left : 0}</span>
              <span dir="ltr" className="mt-1 text-xs text-[var(--member-fg-2)]">{sparks ? sp.ofTotal(sparks.total) : ''}</span>
            </span>
          </ProgressRing>
          {resets ? <p dir="auto" className="text-sm font-semibold">{sp.resets(resets)}</p> : null}
          {empty ? (
            <div dir="auto" className="space-y-1">
              <p className="text-[0.9375rem] font-bold">{sp.resting(resets)}</p>
              <p className="text-[0.8125rem] text-[var(--member-fg-2)]">{sp.restingHint}</p>
            </div>
          ) : null}
        </MembershipHero>

        {empty && isFree ? (
          <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/settings/pro" />} className="w-full font-semibold text-[var(--color-brand-primary-ink)]">{sp.seePro}</Button>
        ) : null}

        <section className="space-y-2">
          <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{sp.costsTitle}</h2>
          <Card padding="none" divide className="overflow-hidden">
            {sp.costs.map((row) => (
              <div key={row.label} dir="ltr" className={cn('flex min-h-[52px] items-center gap-3 px-4 py-2 text-sm', row.n === '0' && 'bg-[var(--color-brand-green-soft)]')}>
                <span dir="auto" className="flex-1 text-[var(--color-brand-text-primary)]">{row.label}</span>
                <span className={cn('font-mono-numbers font-semibold', row.n === '0' ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-text-primary)]')}>{row.n}</span>
              </div>
            ))}
          </Card>
          <p dir="auto" className="text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{sp.smsFree}</p>
        </section>
      </div>
    </SettingsSubPageShell>
  )
}
