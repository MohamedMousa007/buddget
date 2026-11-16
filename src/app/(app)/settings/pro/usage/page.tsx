'use client'

import { useEffect } from 'react'
import { NoticeBanners } from '@/components/features/usage/NoticeHost'
import { UsageMeter } from '@/components/features/usage/UsageMeter'
import { MembershipHero } from '@/components/features/membership/MembershipHero'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FactsTable } from '@/components/ui/FactsTable'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import { useLocale } from '@/lib/i18n'
import { useUsageCopy } from '@/lib/i18n/usageCopy'
import { navigate } from '@/lib/navigation/navigate'
import { clock, shortDate, weekdayDate } from '@/lib/usage/format'
import { featureShares } from '@/lib/usage/featureShares'
import { useUsageStore } from '@/lib/usage/usageStore'

/** The Usage page (replaces the Sparks page): the two meters, Sparks, this week by feature, and the other limits. */
export default function UsagePage() {
  const copy = useUsageCopy()
  const p = copy.page
  const { locale } = useLocale()
  const me = useBillingStore((s) => s.me)
  const refresh = useBillingStore((s) => s.refresh)
  const setPacksOpen = useUsageStore((s) => s.setPacksOpen)
  const on = billingOn(me)

  useEffect(() => {
    if (me && !on) navigate('/settings', { replace: true })
  }, [me, on])
  useEffect(() => { if (on) void refresh() }, [on, refresh])

  if (me && !on) return null
  const usage = me?.usage
  const view = subscriptionView(me)
  const plan = view.kind === 'trial' ? p.trialPlan(view.trialDay ?? 1) : view.proActive ? p.proPlan : p.freePlan
  const paid = view.proActive
  const shares = usage ? featureShares(usage.byFeature) : []

  return (
    <SettingsSubPageShell title={p.title} backHref="/settings/pro">
      {!me ? (
        <SkeletonList rows={4} />
      ) : !usage ? (
        <EmptyState title={p.errorTitle} description={p.errorBody} action={<Button size="touch" onClick={() => void refresh()}>{copy.actions.tryAgain}</Button>} />
      ) : (
        <div className="space-y-5">
          <NoticeBanners screen="usage" />
          <MembershipHero tone="pro">
            <p dir="auto" className="text-sm font-semibold">{plan}</p>
            <div className="flex flex-col gap-4 rounded-[18px] bg-[var(--color-brand-card)] p-4 text-[var(--color-brand-text-primary)]">
              <UsageMeter label={copy.meter.session} pct={usage.session.pct} value={usage.session.pct === null ? '—' : copy.meter.pct(usage.session.pct)} note={usage.session.pct === null ? undefined : usage.session.pct >= 100 ? copy.meter.reached : usage.session.resetAt ? copy.meter.resets(clock(usage.session.resetAt, locale)) : undefined} />
              <UsageMeter label={copy.meter.week} pct={usage.week.pct} value={usage.week.pct === null ? '—' : copy.meter.pct(usage.week.pct)} note={usage.week.pct === null ? undefined : usage.week.pct >= 100 ? copy.meter.reached : copy.meter.resets(weekdayDate(usage.week.resetAt, locale))} />
            </div>
          </MembershipHero>

          <section className="space-y-2">
            <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{paid ? p.sparksHead : p.needMore}</h2>
            <Card padding="md" className="space-y-3">
              <div dir="auto" className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{p.sparksHead}</span>
                <span dir="ltr" className="font-mono-numbers text-3xl font-semibold text-[var(--color-brand-text-primary)]">{usage.sparksLeft}</span>
              </div>
              <p dir="auto" className="text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{p.sparksNote}</p>
              {paid ? <p dir="auto" className="text-xs font-semibold text-[var(--color-brand-primary-ink)]">{p.bonusAdded}</p> : null}
              <div className="flex gap-2">
                <Button size="touch" className="flex-1 font-semibold" onClick={() => setPacksOpen(true)}>{copy.actions.getSparks}</Button>
                {!paid ? <Button size="touch" variant="outline" className="flex-1 font-semibold" onClick={() => navigate('/settings/pro')}>{copy.actions.goPro}</Button> : null}
              </div>
            </Card>
          </section>

          <section className="space-y-2">
            <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{p.byFeature}</h2>
            <Card padding="none" divide className="overflow-hidden">
              {shares.map((row) => (
                <div key={row.key} dir="auto" className="flex min-h-[52px] items-center gap-3 px-4 py-2 text-sm">
                  <span className="flex-1 text-[var(--color-brand-text-primary)]">{p.features[row.key]}</span>
                  <span dir="ltr" className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{copy.meter.pct(row.pct)}</span>
                </div>
              ))}
              <div dir="auto" className="flex min-h-[52px] items-center gap-3 bg-[var(--color-brand-green-soft)] px-4 py-2 text-sm">
                <span className="flex-1 text-[var(--color-brand-text-primary)]">SMS</span>
                <span className="font-semibold text-[var(--color-brand-green)]">{p.smsNever}</span>
              </div>
            </Card>
          </section>

          <section className="space-y-2">
            <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{p.otherLimits}</h2>
            <FactsTable
              rows={[
                { label: p.plans, value: p.plansValue(usage.plans.used, usage.plans.limit) },
                { label: p.views, value: p.viewsValue(usage.balanceViews.used, usage.balanceViews.limit, shortDate(usage.balanceViews.resetAt, locale)) },
                { label: p.advisor, value: usage.advisor.entitled ? p.advisorIncluded : p.advisorValue(usage.advisor.free_left) },
              ]}
            />
          </section>
        </div>
      )}
    </SettingsSubPageShell>
  )
}
